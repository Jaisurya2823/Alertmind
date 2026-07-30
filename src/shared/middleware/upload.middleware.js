/**
 * AlertMind — File Upload Middleware (Multer)
 * Strict MIME type, extension, and size validation
 * Files stored in /storage/temp — moved to MinIO after processing
 */

import multer from 'multer';
import { extname, join } from 'node:path';
import { mkdirSync } from 'node:fs';
import { v4 as uuidv4 } from 'uuid';
import { getConfig } from '../../config/env.js';
import { BadRequestError } from '../errors/app.error.js';
import {
  ALLOWED_UPLOAD_MIME_TYPES,
  ALLOWED_UPLOAD_EXTENSIONS,
} from '../constants/app.constants.js';

const config = getConfig();

// Ensure temp directory exists
const TEMP_UPLOAD_DIR = join(process.cwd(), 'storage', 'temp');
mkdirSync(TEMP_UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, TEMP_UPLOAD_DIR);
  },
  filename: (_req, file, cb) => {
    // Use UUID filename — never trust original filename
    const ext = extname(file.originalname).toLowerCase();
    const safeFilename = `${uuidv4()}${ext}`;
    cb(null, safeFilename);
  },
});

/**
 * Validates file MIME type and extension.
 * Blocks disguised files (e.g., .exe renamed to .json).
 */
function fileFilter(_req, file, cb) {
  const ext = extname(file.originalname).toLowerCase();
  const mime = file.mimetype.toLowerCase();

  const extAllowed = ALLOWED_UPLOAD_EXTENSIONS.includes(ext);
  const mimeAllowed = ALLOWED_UPLOAD_MIME_TYPES.some((allowed) =>
    mime.startsWith(allowed)
  );

  if (!extAllowed || !mimeAllowed) {
    return cb(
      new BadRequestError(
        `File type not allowed. Supported: ${ALLOWED_UPLOAD_EXTENSIONS.join(', ')}`
      )
    );
  }

  cb(null, true);
}

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: config.MAX_FILE_SIZE_MB * 1024 * 1024,
    files: 1, // Only one alert file per request
    fields: 5, // Max non-file fields
    fieldSize: 1024 * 1024, // 1 MB per text field
  },
});

/**
 * Middleware for single alert file upload.
 * Field name: 'alert'
 */
export const uploadAlertFile = upload.single('alert');

/**
 * Middleware that wraps Multer errors into AppError format.
 * @param {import('express').RequestHandler} multerMiddleware
 * @returns {import('express').RequestHandler}
 */
export function wrapMulter(multerMiddleware) {
  return (req, res, next) => {
    multerMiddleware(req, res, (err) => {
      if (!err) return next();

      if (err instanceof multer.MulterError) {
        const messages = {
          LIMIT_FILE_SIZE: `File exceeds the ${config.MAX_FILE_SIZE_MB}MB limit`,
          LIMIT_UNEXPECTED_FILE: 'Unexpected file field — use field name "alert"',
          LIMIT_FILE_COUNT: 'Only one file per upload is allowed',
        };
        return next(new BadRequestError(messages[err.code] || err.message));
      }

      return next(err);
    });
  };
}

export const uploadAlertFileMiddleware = wrapMulter(uploadAlertFile);
