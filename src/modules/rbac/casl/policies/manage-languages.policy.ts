import { ProgrammingLanguage } from 'src/modules/programming-language';
import { Action, AppAbility } from '../casl-ability.factory';
import { IPolicyHandler } from '../policy-handler.interface';

/**
 * Policy: Check if user can manage programming languages
 */
export class ManageLanguagesPolicy implements IPolicyHandler {
  handle(ability: AppAbility): boolean {
    return (
      ability.can(Action.Create, ProgrammingLanguage) ||
      ability.can(Action.Update, ProgrammingLanguage) ||
      ability.can(Action.Delete, ProgrammingLanguage) ||
      ability.can(Action.Activate, ProgrammingLanguage) ||
      ability.can(Action.Deactivate, ProgrammingLanguage)
    );
  }
}
