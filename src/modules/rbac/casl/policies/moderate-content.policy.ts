import { IPolicyHandler } from '../policy-handler.interface';
import { Action, AppAbility } from '../casl-ability.factory';

/**
 * Policy: Check if user can moderate content
 */
export class ModerateContentPolicy implements IPolicyHandler {
  handle(ability: AppAbility): boolean {
    return (
      ability.can(Action.Delete, 'Post') ||
      ability.can(Action.Delete, 'Comment')
    );
  }
}
