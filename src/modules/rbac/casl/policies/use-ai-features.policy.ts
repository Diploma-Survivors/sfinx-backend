import { IPolicyHandler } from '../policy-handler.interface';
import { Action, AppAbility } from '../casl-ability.factory';

/**
 * Policy: Check if user can use AI features
 */
export class UseAIFeaturesPolicy implements IPolicyHandler {
  handle(ability: AppAbility): boolean {
    return (
      ability.can(Action.Interview, 'AI') ||
      ability.can(Action.Hint, 'AI') ||
      ability.can(Action.Unlimited, 'AI')
    );
  }
}
