import {
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';

export class GoogleAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const code = (request.body?.code || request.query?.code) as string;

    if (!code || typeof code !== 'string') {
      throw new UnauthorizedException(
        'Missing or invalid Google authorization code',
      );
    }

    // Attach code to request for easy access in controller
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    request.body = { ...request.body, code: code };

    return true;
  }
}
