/**
 * AlertMind — Express Application
 * Security middleware, route registration, error handling
 */

import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import { pinoHttp } from 'pino-http';
import { doubleCsrf } from 'csrf-csrf';
import { rateLimit } from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { getConfig } from './src/config/env.js';
import logger from './src/shared/logger/logger.js';
import { getRedisClient } from './src/config/redis.config.js';
import { registerRoutes } from './src/bootstrap/routes.js';
import { errorMiddleware } from './src/shared/middleware/error.middleware.js';
import { AppError } from './src/shared/errors/app.error.js';
import { HTTP_STATUS } from './src/shared/constants/app.constants.js';

const config = getConfig();

const app = express();

// ─── Trust Proxy (Required for Kubernetes/Nginx) ──────────────────────────────
// Enables correct IP resolution behind reverse proxy
app.set('trust proxy', 1);

// ─── Helmet — HTTP Security Headers ─────────────────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://cdn.tailwindcss.com', 'https://cdnjs.cloudflare.com'],
        fontSrc: ["'self'", 'https://cdnjs.cloudflare.com'],
        imgSrc: ["'self'", 'data:', 'blob:'],
        connectSrc: ["'self'"],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        upgradeInsecureRequests: config.NODE_ENV === 'production' ? [] : null,
      },
    },
    crossOriginEmbedderPolicy: false,
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    permittedCrossDomainPolicies: { permittedPolicies: 'none' },
  })
);

// ─── CORS ────────────────────────────────────────────────────────────────────
const allowedOrigins = config.CORS_ORIGINS.split(',').map((o) => o.trim());

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, Postman)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      callback(new AppError('Not allowed by CORS', HTTP_STATUS.FORBIDDEN));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'X-Api-Key'],
    exposedHeaders: ['X-Request-Id', 'X-RateLimit-Remaining'],
    maxAge: 86400,
  })
);

// ─── Body Parsers ────────────────────────────────────────────────────────────
app.use(
  express.json({
    limit: `${config.MAX_FILE_SIZE_MB}mb`,
    strict: true,
    type: ['application/json', 'application/json; charset=utf-8'],
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: `${config.MAX_FILE_SIZE_MB}mb`,
  })
);

// ─── Compression ─────────────────────────────────────────────────────────────
app.use(
  compression({
    filter: (req, res) => {
      if (req.headers['x-no-compression']) return false;
      return compression.filter(req, res);
    },
    threshold: 1024,
    level: 6,
  })
);

// ─── Request Logging (Pino) ───────────────────────────────────────────────────
app.use(
  pinoHttp({
    logger,
    customLogLevel: (req, res, err) => {
      if (err || res.statusCode >= 500) return 'error';
      if (res.statusCode >= 400) return 'warn';
      if (res.statusCode >= 300) return 'silent';
      return 'info';
    },
    customProps: (req) => ({
      requestId: req.id,
    }),
    redact: {
      paths: ['req.headers.authorization', 'req.headers["x-api-key"]', 'req.body.password'],
      censor: '[REDACTED]',
    },
    // Do not log health checks — they spam logs
    autoLogging: {
      ignore: (req) => req.url === '/api/health' || req.url === '/api/health/live',
    },
  })
);

// ─── Global Rate Limiting (Redis-backed, works across pods) ─────────────────
const globalRateLimiter = rateLimit({
  windowMs: config.RATE_LIMIT_WINDOW_MS,
  max: config.RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  keyGenerator: (req) => {
    // Use API key for key-authenticated requests, IP otherwise
    return req.headers['x-api-key'] || req.ip;
  },
  store: new RedisStore({
    sendCommand: (...args) => getRedisClient().call(...args),
    prefix: 'rl:global:',
  }),
  handler: (req, res) => {
    res.status(HTTP_STATUS.TOO_MANY_REQUESTS).json({
      success: false,
      error: 'Too many requests. Please retry after the window expires.',
      retryAfter: Math.ceil(config.RATE_LIMIT_WINDOW_MS / 1000),
    });
  },
});

app.use('/api/', globalRateLimiter);

// ─── CSRF Protection (csrf-csrf — replaces deprecated csurf) ────────────────
// Exempts: API key authenticated routes, health check
const { doubleCsrfProtection } = doubleCsrf({
  getSecret: () => config.CSRF_SECRET,
  cookieName: '__Host-psifi.x-csrf-token',
  cookieOptions: {
    sameSite: 'strict',
    secure: config.NODE_ENV === 'production',
    httpOnly: true,
    path: '/',
  },
  size: 64,
  ignoredMethods: ['GET', 'HEAD', 'OPTIONS'],
  getTokenFromRequest: (req) =>
    req.headers['x-csrf-token'] || req.body?._csrf,
});

// Apply CSRF only to browser-originated form/JSON requests
// API key routes are exempt (stateless authentication)
app.use((req, res, next) => {
  const isApiKeyRequest = !!req.headers['x-api-key'];
  const isPublicRoute =
    req.path === '/api/health' ||
    req.path === '/api/health/live' ||
    req.path === '/api/auth/login' ||
    req.path === '/api/auth/register' ||
    req.path === '/api/auth/csrf';

  if (isApiKeyRequest || isPublicRoute) return next();
  return doubleCsrfProtection(req, res, next);
});

// ─── Static Files (public/) ──────────────────────────────────────────────────
app.use(
  express.static('public', {
    maxAge: config.NODE_ENV === 'production' ? '7d' : 0,
    etag: true,
    lastModified: true,
    index: 'index.html',
  })
);

// ─── Register All API Routes ─────────────────────────────────────────────────
registerRoutes(app);

// ─── 404 Handler ─────────────────────────────────────────────────────────────
app.use((req, res, next) => {
  next(new AppError(`Route ${req.method} ${req.path} not found`, HTTP_STATUS.NOT_FOUND));
});

// ─── Global Error Handler (must be last middleware) ──────────────────────────
app.use(errorMiddleware);

export default app;
