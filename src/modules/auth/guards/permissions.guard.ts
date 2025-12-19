import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { PERMISSIONS_KEY, REQUIRE_ALL_PERMISSIONS_KEY } from '../../../common';
import { User } from '../entities/user.entity';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    const requireAllPermissions = this.reflector.getAllAndOverride<string[]>(
      REQUIRE_ALL_PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    // If no permissions required, allow access
    if (
      (!requiredPermissions || requiredPermissions.length === 0) &&
      (!requireAllPermissions || requireAllPermissions.length === 0)
    ) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<Request & { user: User }>();
    const user = request.user;

    if (!user?.role?.permissions) {
      throw new ForbiddenException(
        'You do not have permission to access this resource',
      );
    }

    const userPermissions = user.role.permissions.map(
      (p) => `${p.resource}:${p.action}`,
    );

    // Check if user has ALL required permissions (requireAllPermissions)
    if (requireAllPermissions && requireAllPermissions.length > 0) {
      const hasAllPermissions = requireAllPermissions.every((permission) =>
        userPermissions.includes(permission),
      );

      if (!hasAllPermissions) {
        throw new ForbiddenException(
          'You do not have all the required permissions to access this resource',
        );
      }

      return true;
    }

    // Check if user has ANY of the required permissions (requiredPermissions)
    if (requiredPermissions && requiredPermissions.length > 0) {
      const hasPermission = requiredPermissions.some((permission) =>
        userPermissions.includes(permission),
      );

      if (!hasPermission) {
        throw new ForbiddenException(
          'You do not have the required permissions to access this resource',
        );
      }

      return true;
    }

    return true;
  }
}
