import { Action, AppAbility } from '../../rbac/casl/casl-ability.factory';
import { IPolicyHandler } from '../../rbac/casl/policy-handler.interface';

/**
 * Policy: Check if user can manage contests
 */
export class ManageContestsPolicy implements IPolicyHandler {
  handle(ability: AppAbility): boolean {
    return (
      ability.can(Action.Create, 'Contest') ||
      ability.can(Action.Update, 'Contest') ||
      ability.can(Action.Delete, 'Contest')
    );
  }
}
