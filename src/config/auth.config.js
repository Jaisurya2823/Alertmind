/**
 * AlertMind — Auth Configuration
 * Better Auth initialization with Prisma adapter.
 * Used for session management and social OAuth (future).
 *
 * NOTE: Core authentication (JWT + Argon2id) is implemented directly
 * in src/modules/user/user.service.js and auth.middleware.js.
 * Better Auth is configured here for session management extensions.
 */

import { getConfig } from './env.js';

const env = getConfig();

/**
 * Better Auth configuration object.
 * The Prisma adapter connects Better Auth to the existing PostgreSQL database.
 */
export const authConfig = Object.freeze({
  secret: env.AUTH_SECRET,
  baseUrl: env.APP_URL,
  sessionExpiresIn: env.SESSION_EXPIRY_SECONDS,
  database: {
    // Uses the same DATABASE_URL as Prisma
    url: env.DATABASE_URL,
  },
  session: {
    expiresIn: env.SESSION_EXPIRY_SECONDS,
    updateAge: 86400, // Refresh session after 24h of activity
    cookieCache: {
      enabled: true,
      maxAge: 300, // 5 minutes
    },
  },
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 12,
  },
});

export default authConfig;
