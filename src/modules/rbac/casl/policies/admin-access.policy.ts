import { IPolicyHandler } from '../policy-handler.interface';
import { Action, AppAbility } from '../casl-ability.factory';

/**
 * Policy: Check if user can access admin features
 */
export class AdminAccessPolicy implements IPolicyHandler {
  handle(ability: AppAbility): boolean {
    return ability.can(Action.Access, 'Admin');
  }
}
