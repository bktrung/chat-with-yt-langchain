import * as winston from 'winston';
import { WinstonModuleOptions } from 'nest-winston';
import { APP_CONFIG } from './app.config';

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json(),
);

const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, context, ...meta }) => {
    let msg = `${timestamp} [${context || 'Application'}] ${level}: ${message}`;
    if (Object.keys(meta).length > 0) {
      msg += ` ${JSON.stringify(meta)}`;
    }
    return msg;
  }),
);

export const loggerConfig: WinstonModuleOptions = {
  level: APP_CONFIG.logLevel,
  transports: [
    new winston.transports.Console({
      format: APP_CONFIG.nodeEnv === 'production' ? logFormat : consoleFormat,
    }),
    ...(APP_CONFIG.nodeEnv === 'production'
      ? [
          new winston.transports.File({
            filename: 'logs/error.log',
            level: 'error',
            format: logFormat,
          }),
          new winston.transports.File({
            filename: 'logs/combined.log',
            format: logFormat,
          }),
        ]
      : []),
  ],
};

