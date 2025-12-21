import { IPolicyHandler } from '../policy-handler.interface';
import { Action, AppAbility } from '../casl-ability.factory';
import { Problem } from 'src/modules/problems/entities/problem.entity';

/**
 * Policy: Check if user can access premium features
 */
export class PremiumAccessPolicy implements IPolicyHandler {
  handle(ability: AppAbility): boolean {
    return ability.can(Action.ReadPremium, Problem);
  }
}
