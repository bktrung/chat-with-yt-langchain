import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request } from 'express';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const { method, url, body } = request;
    const userAgent = request.get('user-agent') || '';
    const startTime = Date.now();

    this.logger.log(
      `Incoming Request: ${method} ${url}`,
      {
        method,
        url,
        userAgent,
        body: this.sanitizeBody(body),
      },
    );

    return next.handle().pipe(
      tap({
        next: (data) => {
          const elapsedTime = Date.now() - startTime;
          this.logger.log(
            `Request Completed: ${method} ${url} - ${elapsedTime}ms`,
            {
              method,
              url,
              elapsedTime,
            },
          );
        },
        error: (error) => {
          const elapsedTime = Date.now() - startTime;
          this.logger.error(
            `Request Failed: ${method} ${url} - ${elapsedTime}ms`,
            {
              method,
              url,
              elapsedTime,
              error: error.message,
            },
          );
        },
      }),
    );
  }

  private sanitizeBody(body: any): any {
    if (!body) return body;
    
    // Don't log sensitive information
    const sensitiveFields = ['password', 'token', 'apiKey', 'secret'];
    const sanitized = { ...body };
    
    sensitiveFields.forEach((field) => {
      if (sanitized[field]) {
        sanitized[field] = '***REDACTED***';
      }
    });
    
    return sanitized;
  }
}

