import { IPolicyHandler } from '../policy-handler.interface';
import { Action, AppAbility } from '../casl-ability.factory';

/**
 * Policy: Check if user can manage users
 */
export class ManageUsersPolicy implements IPolicyHandler {
  handle(ability: AppAbility): boolean {
    return (
      ability.can(Action.Ban, 'User') || ability.can(Action.Delete, 'User')
    );
  }
}
