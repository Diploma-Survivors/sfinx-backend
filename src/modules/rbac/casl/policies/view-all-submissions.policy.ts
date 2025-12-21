import { Submission } from 'src/modules/submissions/entities/submission.entity';
import { Action, AppAbility } from '../casl-ability.factory';
import { IPolicyHandler } from '../policy-handler.interface';

/**
 * Policy: Check if user can view all submissions
 */
export class ViewAllSubmissionsPolicy implements IPolicyHandler {
  handle(ability: AppAbility): boolean {
    return ability.can(Action.ReadAll, Submission);
  }
}
