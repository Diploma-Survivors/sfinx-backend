import { User } from 'src/modules/auth/entities/user.entity';
import { Action, AppAbility } from '../casl-ability.factory';
import { IPolicyHandler } from '../policy-handler.interface';

/**
 * Policy: Check if user can manage users
 */
export class ManageUsersPolicy implements IPolicyHandler {
  handle(ability: AppAbility): boolean {
    return ability.can(Action.Ban, User) || ability.can(Action.Delete, User);
  }
}
