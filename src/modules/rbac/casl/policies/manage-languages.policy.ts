import { IPolicyHandler } from '../policy-handler.interface';
import { Action, AppAbility } from '../casl-ability.factory';

/**
 * Policy: Check if user can manage programming languages
 */
export class ManageLanguagesPolicy implements IPolicyHandler {
  handle(ability: AppAbility): boolean {
    return (
      ability.can(Action.Create, 'Language') ||
      ability.can(Action.Update, 'Language') ||
      ability.can(Action.Delete, 'Language') ||
      ability.can(Action.Activate, 'Language') ||
      ability.can(Action.Deactivate, 'Language')
    );
  }
}
