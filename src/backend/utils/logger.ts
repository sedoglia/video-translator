import winston from 'winston';
import path from 'path';
import fs from 'fs';

const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, jobId, stage, ...meta }) => {
    let logMessage = `[${timestamp}] ${level.toUpperCase()}`;
    if (jobId) logMessage += ` [Job: ${jobId}]`;
    if (stage) logMessage += ` [${stage}]`;
    logMessage += `: ${message}`;
    if (Object.keys(meta).length > 0) {
      logMessage += ` ${JSON.stringify(meta)}`;
    }
    return logMessage;
  })
);

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  transports: [
    new winston.transports.File({ filename: path.join(logsDir, 'error.log'), level: 'error' }),
    new winston.transports.File({ filename: path.join(logsDir, 'combined.log') }),
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        logFormat
      )
    })
  ]
});

export class JobLogger {
  constructor(private jobId: string) {}

  info(message: string, meta?: any) {
    logger.info(message, { jobId: this.jobId, ...meta });
  }

  warn(message: string, meta?: any) {
    logger.warn(message, { jobId: this.jobId, ...meta });
  }

  error(message: string, meta?: any) {
    logger.error(message, { jobId: this.jobId, ...meta });
  }

  debug(message: string, meta?: any) {
    logger.debug(message, { jobId: this.jobId, ...meta });
  }

  stage(stage: string, message: string, meta?: any) {
    logger.info(message, { jobId: this.jobId, stage, ...meta });
  }
}
