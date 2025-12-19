import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';

/**
 * Optional JWT Authentication Guard
 *
 * This guard allows requests to proceed whether or not a valid JWT token is present.
 * If a valid token is provided, the user will be attached to the request.
 * If no token or an invalid token is provided, the request continues without a user.
 *
 * Use this for endpoints that should work for both authenticated and unauthenticated users,
 * but may provide different data or behavior based on authentication status.
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  /**
   * Override handleRequest to not throw errors on authentication failure
   */
  handleRequest<TUser = any>(err: any, user: TUser): TUser {
    // If there's an error or no user, just return undefined instead of throwing
    // This allows the request to continue without authentication
    if (err || !user) {
      return undefined as TUser;
    }

    return user;
  }

  /**
   * Check if Authorization header exists before attempting authentication
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();

    // Check if Authorization header exists
    const authHeader = request.headers.authorization;

    // If no Authorization header, skip authentication
    if (!authHeader) {
      return true;
    }

    try {
      // Try to authenticate if header is present
      await super.canActivate(context);
    } catch (error) {
      // Silently ignore authentication errors
      // The request will proceed without a user
      console.log(error);
    }

    // Always allow the request to continue
    return true;
  }
}
