import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Request } from 'express';
import { User } from '../../../auth/entities/user.entity';

/**
 * Guard that ensures the user has verified their email
 * Required for commenting to prevent spam
 */
@Injectable()
export class EmailVerifiedGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user: User }>();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException(
        'You must be authenticated to perform this action',
      );
    }

    if (!user.emailVerified) {
      throw new ForbiddenException(
        'Email verification required to comment. Please verify your email address.',
      );
    }

    return true;
  }
}
