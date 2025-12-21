import {
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import {
  CHECK_ABILITY_KEY,
  CHECK_POLICIES_KEY,
  RequiredRule,
} from '../../../common';
import { CaslAbilityFactory } from '../../rbac/casl/casl-ability.factory';
import { PolicyHandler } from '../../rbac/casl/policy-handler.interface';
import { User } from '../entities/user.entity';
import { JwtAuthGuard } from './jwt-auth.guard';

@Injectable()
export class CaslGuard extends JwtAuthGuard {
  constructor(
    private reflector: Reflector,
    private caslAbilityFactory: CaslAbilityFactory,
  ) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Check for ability rules and policy handlers first
    const rules =
      this.reflector.get<RequiredRule[]>(
        CHECK_ABILITY_KEY,
        context.getHandler(),
      ) || [];

    const policyHandlers =
      this.reflector.get<PolicyHandler[]>(
        CHECK_POLICIES_KEY,
        context.getHandler(),
      ) || [];

    // If no CASL rules or policies are defined, just do JWT authentication
    if (rules.length === 0 && policyHandlers.length === 0) {
      return super.canActivate(context) as Promise<boolean>;
    }

    // First, authenticate using JWT
    // This calls JwtStrategy.validate() which loads the full User entity
    // with role and permissions relations
    const isAuthenticated = await super.canActivate(context);

    if (!isAuthenticated) {
      return false;
    }

    // Get the authenticated user (now populated by JWT strategy)
    const request = context
      .switchToHttp()
      .getRequest<Request & { user: User }>();
    const user = request?.user;

    // If no user after authentication, deny access
    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    // Create CASL ability for the authenticated user
    const ability = this.caslAbilityFactory.createForUser(user);

    // Check all required ability rules
    for (const rule of rules) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const { action, subject, conditions, fields } = rule;

      let allowed = false;

      if (fields) {
        // Check field-level permissions
        allowed = fields.every((field) => ability.can(action, subject, field));
      } else if (conditions) {
        // Check with conditions
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        allowed = ability.can(action, subject, conditions);
      } else {
        // Check simple permission
        allowed = ability.can(action, subject);
      }

      if (!allowed) {
        const subjectName =
          typeof subject === 'string'
            ? subject
            : typeof subject === 'function'
              ? subject.name
              : subject?.constructor?.name || 'unknown';
        throw new ForbiddenException(
          `You do not have permission to ${action.toString()} ${subjectName}`,
        );
      }
    }

    // Check all policy handlers
    for (const handler of policyHandlers) {
      let allowed = false;

      if (typeof handler === 'function') {
        // Handler is a callback function
        allowed = handler(ability);
      } else {
        // Handler is an object with handle method
        allowed = handler.handle(ability);
      }

      if (!allowed) {
        throw new ForbiddenException(
          'You do not have the required permissions',
        );
      }
    }

    return true;
  }
}
