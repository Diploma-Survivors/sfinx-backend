import { IPolicyHandler } from '../policy-handler.interface';
import { Action, AppAbility } from '../casl-ability.factory';

/**
 * Policy: Check if user can access premium features
 */
export class PremiumAccessPolicy implements IPolicyHandler {
  handle(ability: AppAbility): boolean {
    return ability.can(Action.ReadPremium, 'Problem');
  }
}
