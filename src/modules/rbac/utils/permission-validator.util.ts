import { Action } from '../casl/casl-ability.factory';

/**
 * Validates that database permissions can be mapped to CASL actions and subjects
 * This ensures synchronization between the database schema and CASL implementation
 */
export class PermissionValidator {
  /**
   * Map of all valid database actions to CASL Action enum
   * This must be kept in sync with CaslAbilityFactory.mapActionToCasl()
   */
  private static readonly ACTION_MAP: Record<string, Action> = {
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
  };

  /**
   * Map of all valid database resources to CASL subjects
   * This must be kept in sync with CaslAbilityFactory.mapResourceToSubject()
   */
  private static readonly RESOURCE_MAP: Record<string, string> = {
    problem: 'Problem',
    submission: 'Submission',
    contest: 'Contest',
    user: 'User',
    post: 'Post',
    comment: 'Comment',
    admin: 'Admin',
    ai: 'AI',
    payment: 'Payment',
    role: 'Role',
    permission: 'Permission',
  };

  /**
   * Validate that an action can be mapped to CASL
   */
  static isValidAction(action: string): boolean {
    return action in this.ACTION_MAP;
  }

  /**
   * Validate that a resource can be mapped to CASL
   */
  static isValidResource(resource: string): boolean {
    return resource in this.RESOURCE_MAP;
  }

  /**
   * Validate a permission (resource + action pair)
   */
  static isValidPermission(resource: string, action: string): boolean {
    return this.isValidResource(resource) && this.isValidAction(action);
  }

  /**
   * Get the CASL action for a database action
   */
  static getCaslAction(action: string): Action | null {
    return this.ACTION_MAP[action] || null;
  }

  /**
   * Get the CASL subject for a database resource
   */
  static getCaslSubject(resource: string): string | null {
    return this.RESOURCE_MAP[resource] || null;
  }

  /**
   * Get all valid action names
   */
  static getValidActions(): string[] {
    return Object.keys(this.ACTION_MAP);
  }

  /**
   * Get all valid resource names
   */
  static getValidResources(): string[] {
    return Object.keys(this.RESOURCE_MAP);
  }

  /**
   * Validate an array of permissions and return validation results
   */
  static validatePermissions(
    permissions: Array<{ resource: string; action: string }>,
  ): {
    valid: Array<{ resource: string; action: string }>;
    invalid: Array<{ resource: string; action: string; reason: string }>;
  } {
    const valid: Array<{ resource: string; action: string }> = [];
    const invalid: Array<{
      resource: string;
      action: string;
      reason: string;
    }> = [];

    for (const perm of permissions) {
      const { resource, action } = perm;

      if (!this.isValidResource(resource)) {
        invalid.push({
          resource,
          action,
          reason: `Invalid resource: '${resource}'. Valid resources: ${this.getValidResources().join(', ')}`,
        });
      } else if (!this.isValidAction(action)) {
        invalid.push({
          resource,
          action,
          reason: `Invalid action: '${action}'. Valid actions: ${this.getValidActions().join(', ')}`,
        });
      } else {
        valid.push(perm);
      }
    }

    return { valid, invalid };
  }

  /**
   * Generate a validation report for permissions
   */
  static generateReport(
    permissions: Array<{ resource: string; action: string }>,
  ): string {
    const { valid, invalid } = this.validatePermissions(permissions);

    let report = '=== Permission Validation Report ===\n\n';
    report += `Total Permissions: ${permissions.length}\n`;
    report += `Valid: ${valid.length}\n`;
    report += `Invalid: ${invalid.length}\n\n`;

    if (invalid.length > 0) {
      report += '--- Invalid Permissions ---\n';
      invalid.forEach((inv) => {
        report += `❌ ${inv.resource}:${inv.action} - ${inv.reason}\n`;
      });
      report += '\n';
    }

    if (valid.length > 0) {
      report += '--- Valid Permissions ---\n';
      valid.forEach((v) => {
        const caslAction = this.getCaslAction(v.action);
        const caslSubject = this.getCaslSubject(v.resource);
        report += `✅ ${v.resource}:${v.action} → ${caslAction}(${caslSubject})\n`;
      });
    }

    return report;
  }
}
