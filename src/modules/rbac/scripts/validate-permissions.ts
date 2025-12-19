/**
 * Standalone script to validate all seeded permissions against CASL mappings
 * Run with: bun run src/modules/rbac/scripts/validate-permissions.ts
 *
 * This is a standalone validator that doesn't import entities to avoid circular dependencies
 */

enum Action {
  Manage = 'manage',
  Create = 'create',
  Read = 'read',
  Update = 'update',
  Delete = 'delete',
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
}

const ACTION_MAP: Record<string, Action> = {
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

const RESOURCE_MAP: Record<string, string> = {
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

// These are the exact permissions from the seed file
const SEEDED_PERMISSIONS = [
  // Problems
  { resource: 'problem', action: 'create' },
  { resource: 'problem', action: 'read' },
  { resource: 'problem', action: 'update' },
  { resource: 'problem', action: 'delete' },
  { resource: 'problem', action: 'read_premium' },

  // Submissions
  { resource: 'submission', action: 'create' },
  { resource: 'submission', action: 'read' },
  { resource: 'submission', action: 'read_all' },

  // Contests
  { resource: 'contest', action: 'create' },
  { resource: 'contest', action: 'read' },
  { resource: 'contest', action: 'update' },
  { resource: 'contest', action: 'delete' },
  { resource: 'contest', action: 'join' },
  { resource: 'contest', action: 'join_premium' },

  // Users
  { resource: 'user', action: 'read' },
  { resource: 'user', action: 'update' },
  { resource: 'user', action: 'ban' },
  { resource: 'user', action: 'delete' },

  // Admin
  { resource: 'admin', action: 'access' },
  { resource: 'admin', action: 'roles' },
  { resource: 'admin', action: 'statistics' },

  // AI Features
  { resource: 'ai', action: 'interview' },
  { resource: 'ai', action: 'hint' },
  { resource: 'ai', action: 'unlimited' },

  // Community
  { resource: 'post', action: 'create' },
  { resource: 'post', action: 'update' },
  { resource: 'post', action: 'delete' },
  { resource: 'comment', action: 'create' },
  { resource: 'comment', action: 'delete' },

  // Payment
  { resource: 'payment', action: 'create' },
];

function validatePermissions(
  permissions: Array<{ resource: string; action: string }>,
): {
  valid: Array<{ resource: string; action: string }>;
  invalid: Array<{ resource: string; action: string; reason: string }>;
} {
  const valid: Array<{ resource: string; action: string }> = [];
  const invalid: Array<{ resource: string; action: string; reason: string }> =
    [];

  for (const perm of permissions) {
    const { resource, action } = perm;

    if (!(resource in RESOURCE_MAP)) {
      invalid.push({
        resource,
        action,
        reason: `Invalid resource: '${resource}'. Valid resources: ${Object.keys(RESOURCE_MAP).join(', ')}`,
      });
    } else if (!(action in ACTION_MAP)) {
      invalid.push({
        resource,
        action,
        reason: `Invalid action: '${action}'. Valid actions: ${Object.keys(ACTION_MAP).join(', ')}`,
      });
    } else {
      valid.push(perm);
    }
  }

  return { valid, invalid };
}

function main() {
  console.log('🔍 Validating seeded permissions against CASL mappings...\n');

  const { valid, invalid } = validatePermissions(SEEDED_PERMISSIONS);

  console.log('=== Permission Validation Report ===\n');
  console.log(`Total Permissions: ${SEEDED_PERMISSIONS.length}`);
  console.log(`Valid: ${valid.length}`);
  console.log(`Invalid: ${invalid.length}\n`);

  if (invalid.length > 0) {
    console.log('--- Invalid Permissions ---');
    invalid.forEach((inv) => {
      console.log(`❌ ${inv.resource}:${inv.action} - ${inv.reason}`);
    });
    console.log('');
  }

  if (valid.length > 0) {
    console.log('--- Valid Permissions ---');
    valid.forEach((v) => {
      const caslAction = ACTION_MAP[v.action];
      const caslSubject = RESOURCE_MAP[v.resource];
      console.log(
        `✅ ${v.resource}:${v.action} → ${caslAction}(${caslSubject})`,
      );
    });
  }

  if (invalid.length > 0) {
    console.error('\n❌ VALIDATION FAILED!');
    console.error(
      'Some seeded permissions cannot be mapped to CASL actions/subjects.',
    );
    console.error('Please update either:');
    console.error(
      '  1. src/modules/rbac/casl/casl-ability.factory.ts (add missing mappings)',
    );
    console.error(
      '  2. src/database/seeds/1-roles-permissions.seed.ts (fix invalid permissions)',
    );
    process.exit(1);
  } else {
    console.log(
      '\n✅ SUCCESS! All seeded permissions are properly mapped to CASL.',
    );
    console.log(
      `   ${valid.length}/${SEEDED_PERMISSIONS.length} permissions validated.`,
    );
    process.exit(0);
  }
}

main();
