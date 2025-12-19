import { Request, Response } from 'express';

import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Environment } from '../enums';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);
  private readonly nodeEnv: Environment;

  constructor(private readonly configService: ConfigService) {
    this.nodeEnv = this.configService.getOrThrow<Environment>('app.nodeEnv');
  }

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    if (exception instanceof HttpException) {
      this.handleHttpException(exception, request, response);
    } else {
      this.handleSystemException(exception, request, response);
    }
  }

  private handleHttpException(
    exception: HttpException,
    request: Request,
    response: Response,
  ) {
    const status = exception.getStatus();
    const message = exception.message;
    const errorResponse = exception.getResponse() as
      | string
      | Record<string, unknown>;

    this.logHttpException(exception, request);

    response.status(status).json({
      statusCode: status,
      message: message,
      error:
        typeof errorResponse === 'string'
          ? errorResponse
          : errorResponse?.message,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }

  private handleSystemException(
    exception: unknown,
    request: Request,
    response: Response,
  ) {
    this.logSystemException(exception, request);

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
      error:
        this.nodeEnv === Environment.DEVELOPMENT
          ? (exception as Error).message
          : 'Something went wrong',
      cause:
        this.nodeEnv === Environment.DEVELOPMENT
          ? (exception as Error).stack
          : undefined,
    });
  }

  private logHttpException(
    exception: HttpException,
    request: Request,
    options?: Record<string, unknown>,
  ) {
    const errorResponse = exception.getResponse();
    const error =
      typeof errorResponse === 'string'
        ? errorResponse
        : (errorResponse as Error)?.message || errorResponse;

    this.logger.error(
      `HTTP Exception: ${exception.message}\t
      STACK: ${(exception as Error).stack}\t
      INFO: ${JSON.stringify({
        statusCode: exception.getStatus(),
        path: request.url,
        method: request.method,
        userAgent: request.get('User-Agent'),
        ip: request.ip,
        error,
        ...options,
      })}`,
    );
  }

  private logSystemException(exception: unknown, request: Request) {
    this.logger.error(
      `System Exception: ${(exception as Error).message}\t
      STACK: ${(exception as Error).stack}\t
      INFO: ${JSON.stringify({
        path: request.url,
        method: request.method,
        userAgent: request.get('User-Agent'),
        ip: request.ip,
      })}`,
    );
  }
}
