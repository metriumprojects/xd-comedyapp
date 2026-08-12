const winston = require('winston');
const path = require('path');
const fs = require('fs');

// Ensure logs directory exists (file transports fail silently-ish if missing)
const logsDir = path.join(__dirname, '../../logs');
try {
  if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
} catch (_) {}

const isProd = process.env.NODE_ENV === 'production';
const isTest = process.env.NODE_ENV === 'test';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  ),
  defaultMeta: { service: 'comedy-app-backend' },
  transports: [
    // ALWAYS log to console so Render / Docker / Railway show logs.
    // Previously console was disabled in production, so email/auth errors
    // were invisible in the Render dashboard while clients still got 500s.
    ...(!isTest
      ? [
          new winston.transports.Console({
            format: isProd
              ? winston.format.combine(
                  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
                  winston.format.printf(({ timestamp, level, message, ...meta }) => {
                    const rest = Object.keys(meta).length && meta.service
                      ? (() => {
                          const { service, ...others } = meta;
                          const extra = Object.keys(others).length ? ` ${JSON.stringify(others)}` : '';
                          return extra;
                        })()
                      : '';
                    return `${timestamp} [${level}] ${message}${rest}`;
                  })
                )
              : winston.format.combine(winston.format.colorize(), winston.format.simple()),
          }),
        ]
      : []),
    ...(!isTest
      ? [
          new winston.transports.File({
            filename: path.join(logsDir, 'error.log'),
            level: 'error',
            maxsize: 5 * 1024 * 1024,
            maxFiles: 5,
          }),
          new winston.transports.File({
            filename: path.join(logsDir, 'combined.log'),
            maxsize: 5 * 1024 * 1024,
            maxFiles: 5,
          }),
        ]
      : []),
  ],
});

module.exports = logger;
