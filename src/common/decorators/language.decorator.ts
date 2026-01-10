import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

export const Language = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<Request>();

    // 1. Check Query Parameter (?lang=vi)
    if (request.query && typeof request.query.lang === 'string') {
      return request.query.lang;
    }

    // 2. Check Accept-Language Header
    const acceptLanguage = request.headers['accept-language'];
    if (acceptLanguage && typeof acceptLanguage === 'string') {
      // Simple parser: take the first 2 characters (e.g., 'en-US' -> 'en')
      // For more complex parsing, a library is better, but this suffices for simple 'en'/'vi' support
      return acceptLanguage.split(',')[0].trim().substring(0, 2);
    }

    // 3. Fallback default
    return 'en';
  },
);
