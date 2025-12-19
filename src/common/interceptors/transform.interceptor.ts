import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { Request } from 'express';
import { SKIP_TRANSFORM_RESPONSE } from '../decorators/skip-transform.decorator';

export interface Response<T> {
  data: T;
  statusCode: number;
  timestamp: string;
  path: string;
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<
  T,
  Response<T>
> {
  constructor(private readonly reflector: Reflector) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<Response<T>> {
    const skip = this.reflector.getAllAndOverride<boolean>(
      SKIP_TRANSFORM_RESPONSE,
      [context.getHandler(), context.getClass()],
    );

    if (skip) {
      return next.handle(); // eslint-disable-line @typescript-eslint/no-unsafe-return
    }

    const request = context.switchToHttp().getRequest<Request>();
    const statusCode = context
      .switchToHttp()
      .getResponse<{ statusCode: number }>().statusCode;

    return next.handle().pipe(
      map((data: T) => ({
        data,
        statusCode,
        timestamp: new Date().toISOString(),
        path: request.url,
      })),
    );
  }
}
