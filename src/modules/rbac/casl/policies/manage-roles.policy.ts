import { IPolicyHandler } from '../policy-handler.interface';
import { Action, AppAbility } from '../casl-ability.factory';

/**
 * Policy: Check if user can manage roles and permissions
 */
export class ManageRolesPolicy implements IPolicyHandler {
  handle(ability: AppAbility): boolean {
    return ability.can(Action.Roles, 'Admin');
  }
}
