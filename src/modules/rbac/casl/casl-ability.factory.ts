import {
  AbilityBuilder,
  AbilityClass,
  ExtractSubjectType,
  InferSubjects,
  PureAbility,
} from '@casl/ability';
import { Injectable } from '@nestjs/common';
import { RefreshToken } from '../../auth/entities/refresh-token.entity';
import { User } from '../../auth/entities/user.entity';
import { ProblemComment } from '../../problems/comments/entities/problem-comment.entity';
import { CommentReport } from '../../problems/comments/entities/comment-report.entity';
import { Problem } from '../../problems/entities/problem.entity';
import { SampleTestcase } from '../../problems/entities/sample-testcase.entity';
import { Tag } from '../../problems/entities/tag.entity';
import { Topic } from '../../problems/entities/topic.entity';
import { ProgrammingLanguage } from '../../programming-language/entities/programming-language.entity';
import { Submission } from '../../submissions/entities/submission.entity';
import { UserProblemProgress } from '../../submissions/entities/user-problem-progress.entity';
import { Permission } from '../entities/permission.entity';
import { Role } from '../entities/role.entity';
import { SubscriptionPlan } from '../../payments/entities/subscription-plan.entity';
import { SubscriptionFeature } from '../../payments/entities/subscription-feature.entity';

// Define all possible actions
export enum Action {
  Manage = 'manage', // Special action: grants all permissions
  Create = 'create',
  Read = 'read',
  Update = 'update',
  Delete = 'delete',
  // Custom actions
  ReadPremium = 'read_premium',
  ReadAll = 'read_all',
  Join = 'join',
  JoinPremium = 'join_premium',
  Ban = 'ban',
  Access = 'access',
  Roles = 'roles',
  Statistics = 'statistics',
  Interview = 'interview',
  Hint = 'hint',
  Unlimited = 'unlimited',
  Activate = 'activate',
  Deactivate = 'deactivate',
}

// Define all possible subjects (resources)
export type Subjects =
  | InferSubjects<
      | typeof User
      | typeof RefreshToken
      | typeof Problem
      | typeof Tag
      | typeof Topic
      | typeof SampleTestcase
      | typeof Submission
      | typeof UserProblemProgress
      | typeof Role
      | typeof Permission
      | typeof ProgrammingLanguage
      | typeof ProblemComment
      | typeof CommentReport
      | typeof SubscriptionPlan
      | typeof SubscriptionFeature
    >
  | 'Problem'
  | 'Tag'
  | 'Topic'
  | 'SampleTestcase'
  | 'Submission'
  | 'UserProblemProgress'
  | 'Contest'
  | 'User'
  | 'RefreshToken'
  | 'Post'
  | 'Comment'
  | 'CommentReport'
  | 'Admin'
  | 'AI'
  | 'Payment'
  | 'Role'
  | 'Permission'
  | 'Language'
  | 'all'; // Special subject: represents all resources

// Define the AppAbility type
export type AppAbility = PureAbility<[Action, Subjects]>;

@Injectable()
export class CaslAbilityFactory {
  createForUser(user: User): AppAbility {
    const { can, cannot, build } = new AbilityBuilder<AppAbility>(
      PureAbility as AbilityClass<AppAbility>,
    );

    // If user has no role, return empty ability (no permissions)
    if (!user?.role) {
      return build({
        detectSubjectType: (item) =>
          item.constructor as ExtractSubjectType<Subjects>,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        conditionsMatcher: this.conditionsMatcher.bind(this),
      });
    }

    const permissions = user.role.permissions || [];

    // Admin gets full access
    if (user.role.slug === 'admin') {
      can(Action.Manage, 'all');
      return build({
        detectSubjectType: (item) =>
          item.constructor as ExtractSubjectType<Subjects>,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        conditionsMatcher: this.conditionsMatcher.bind(this),
      });
    }

    // Map permissions to CASL abilities
    permissions.forEach((permission: Permission) => {
      const action = this.mapActionToCasl(permission.action);
      const subject = this.mapResourceToSubject(permission.resource);

      if (action && subject) {
        can(action, subject as ExtractSubjectType<Subjects>);
      }
    });

    // Add conditional permissions based on user properties
    this.defineConditionalPermissions(can, cannot, user, permissions);

    return build({
      detectSubjectType: (item) =>
        item.constructor as ExtractSubjectType<Subjects>,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      conditionsMatcher: this.conditionsMatcher.bind(this),
    });
  }

  /**
   * Define conditional permissions based on ownership and other conditions
   */
  private defineConditionalPermissions(
    can: AbilityBuilder<AppAbility>['can'],
    cannot: AbilityBuilder<AppAbility>['cannot'],
    user: User,
    permissions: Permission[],
  ): void {
    // Users can update their own profile
    if (this.hasPermission(permissions, 'user', 'update')) {
      can(Action.Update, User, { id: user.id });
    }

    // Users can read their own submissions
    if (this.hasPermission(permissions, 'submission', 'read')) {
      can(Action.Read, Submission, { 'user.id': user.id });
    }

    // Users can update/delete their own posts
    if (this.hasPermission(permissions, 'post', 'update')) {
      can(Action.Update, 'Post', { 'user.id': user.id });
    }

    if (this.hasPermission(permissions, 'post', 'delete')) {
      can(Action.Delete, 'Post', { 'user.id': user.id });
    }

    // Users can delete their own comments
    if (this.hasPermission(permissions, 'comment', 'delete')) {
      can(Action.Delete, 'Comment', { 'user.id': user.id });
    }

    // Premium users can access premium content
    if (user.isPremium) {
      can(Action.ReadPremium, Problem);
      can(Action.ReadPremium, Problem, { isPremium: true });
      can(Action.JoinPremium, 'Contest');
    } else {
      // Free users cannot access premium content
      cannot(Action.ReadPremium, Problem);
      cannot(Action.ReadPremium, Problem, { isPremium: true });
      cannot(Action.JoinPremium, 'Contest');
    }

    // Banned users cannot create content
    if (user.isBanned) {
      cannot(Action.Create, 'Post');
      cannot(Action.Create, 'Comment');
      cannot(Action.Create, Submission);
    }

    // Inactive users have limited access
    if (!user.isActive) {
      cannot(Action.Create, 'all');
      cannot(Action.Update, 'all');
      cannot(Action.Delete, 'all');
    }
  }

  /**
   * Map database action to CASL Action enum
   */
  private mapActionToCasl(action: string): Action | null {
    const actionMap: Record<string, Action> = {
      create: Action.Create,
      read: Action.Read,
      update: Action.Update,
      delete: Action.Delete,
      read_premium: Action.ReadPremium,
      read_all: Action.ReadAll,
      join: Action.Join,
      join_premium: Action.JoinPremium,
      ban: Action.Ban,
      access: Action.Access,
      roles: Action.Roles,
      statistics: Action.Statistics,
      interview: Action.Interview,
      hint: Action.Hint,
      unlimited: Action.Unlimited,
      manage: Action.Manage,
      activate: Action.Activate,
      deactivate: Action.Deactivate,
    };

    return actionMap[action] || null;
  }

  /**
   * Map database resource to CASL Subject
   */
  private mapResourceToSubject(resource: string): Subjects | null {
    const subjectMap: Record<string, Subjects> = {
      problem: Problem,
      tag: Tag,
      topic: Topic,
      sample_testcase: SampleTestcase,
      submission: Submission,
      user_problem_progress: UserProblemProgress,
      contest: 'Contest',
      user: User,
      refresh_token: RefreshToken,
      post: 'Post',
      comment: ProblemComment,
      admin: 'Admin',
      ai: 'AI',
      payment: 'Payment',
      role: 'Role',
      permission: 'Permission',
      language: 'Language',
    };

    return subjectMap[resource] || null;
  }

  /**
   * Check if user has a specific permission
   */
  private hasPermission(
    permissions: Permission[],
    resource: string,
    action: string,
  ): boolean {
    return permissions.some(
      (p) => p.resource === resource && p.action === action,
    );
  }

  /**
   * Custom conditions matcher for field-based permission checking
   * Handles both simple fields (id) and nested fields (user.id)
   */
  private conditionsMatcher(conditions: Record<string, unknown>) {
    return (object: Record<string, unknown>) => {
      return Object.keys(conditions).every((key) => {
        const expectedValue = conditions[key];

        // Handle nested paths like 'user.id'
        const actualValue = key.split('.').reduce<unknown>((obj, k) => {
          if (obj && typeof obj === 'object' && k in obj) {
            return (obj as Record<string, unknown>)[k];
          }
          return undefined;
        }, object);

        return actualValue === expectedValue;
      });
    };
  }
}
