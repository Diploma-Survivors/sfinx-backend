import { SetMetadata } from '@nestjs/common';
import { Action, Subjects } from '../../modules/rbac/casl/casl-ability.factory';
import { PolicyHandler } from '../../modules/rbac/casl/policy-handler.interface';

export const CHECK_ABILITY_KEY = 'check_ability';
export const CHECK_POLICIES_KEY = 'check_policies';

/**
 * Interface for defining a required rule
 */
export interface RequiredRule {
  action: Action;
  subject: Subjects;

  conditions?: any;
  fields?: string[];
}

/**
 * Decorator to check CASL abilities on a route
 *
 * @example
 * // Simple permission check
 * @CheckAbility({ action: Action.Create, subject: 'Problem' })
 *
 * @example
 * // Multiple permission checks
 * @CheckAbility(
 *   { action: Action.Create, subject: 'Problem' },
 *   { action: Action.Update, subject: 'Problem' }
 * )
 *
 * @example
 * // Conditional permission check
 * @CheckAbility({
 *   action: Action.Update,
 *   subject: 'User',
 *   conditions: { id: userId } // Will be evaluated at runtime
 * })
 *
 * @example
 * // Field-level permission check
 * @CheckAbility({
 *   action: Action.Read,
 *   subject: 'User',
 *   fields: ['email', 'phone'] // Check access to specific fields
 * })
 */
export const CheckAbility = (...requirements: RequiredRule[]) =>
  SetMetadata(CHECK_ABILITY_KEY, requirements);

/**
 * Decorator to check complex policies on a route
 *
 * @example
 * // Using policy handler class
 * @CheckPolicies(new ManageProblemsPolicy())
 *
 * @example
 * // Using inline callback
 * @CheckPolicies((ability: AppAbility) => ability.can(Action.Create, 'Problem'))
 *
 * @example
 * // Multiple policies
 * @CheckPolicies(
 *   new AdminAccessPolicy(),
 *   (ability) => ability.can(Action.Manage, 'all')
 * )
 */
export const CheckPolicies = (...handlers: PolicyHandler[]) =>
  SetMetadata(CHECK_POLICIES_KEY, handlers);
