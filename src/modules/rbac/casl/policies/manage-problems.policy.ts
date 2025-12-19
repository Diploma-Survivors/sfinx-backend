import { IPolicyHandler } from '../policy-handler.interface';
import { Action, AppAbility } from '../casl-ability.factory';

/**
 * Policy: Check if user can manage problems
 */
export class ManageProblemsPolicy implements IPolicyHandler {
  handle(ability: AppAbility): boolean {
    return (
      ability.can(Action.Create, 'Problem') ||
      ability.can(Action.Update, 'Problem') ||
      ability.can(Action.Delete, 'Problem')
    );
  }
}
