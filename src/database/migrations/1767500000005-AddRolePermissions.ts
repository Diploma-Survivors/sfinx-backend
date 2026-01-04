import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRolePermissions1767500000005 implements MigrationInterface {
  name = 'AddRolePermissions1767500000005';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const permissions = [
      {
        resource: 'role',
        action: 'create',
        description: 'Create new roles',
      },
      {
        resource: 'role',
        action: 'read',
        description: 'View roles and permissions',
      },
      {
        resource: 'role',
        action: 'update',
        description: 'Update roles and assign permissions',
      },
      {
        resource: 'role',
        action: 'delete',
        description: 'Delete roles',
      },
    ];

    // Get Admin role ID
    const adminRole = (await queryRunner.query(
      `SELECT id FROM roles WHERE slug = 'admin'`,
    )) as Array<{ id: number }>;
    const adminRoleId = adminRole[0]?.id;

    if (!adminRoleId) {
      console.warn('Admin role not found, skipping permission assignment');
    }

    for (const perm of permissions) {
      // 1. Insert Permission if not exists
      await queryRunner.query(`
        INSERT INTO "permissions" ("resource", "action", "description", "created_at", "updated_at")
        SELECT '${perm.resource}', '${perm.action}', '${perm.description}', now(), now()
        WHERE NOT EXISTS (
            SELECT 1 FROM "permissions" WHERE "resource" = '${perm.resource}' AND "action" = '${perm.action}'
        );
      `);

      // 2. Assign to Admin Role
      if (adminRoleId) {
        // Get Permission ID
        const permRecord = (await queryRunner.query(
          `SELECT id FROM permissions WHERE resource = '${perm.resource}' AND action = '${perm.action}'`,
        )) as Array<{ id: number }>;
        const permId = permRecord[0]?.id;

        if (permId) {
          await queryRunner.query(`
            INSERT INTO "role_permissions" ("role_id", "permission_id")
            SELECT ${adminRoleId}, ${permId}
            WHERE NOT EXISTS (
                SELECT 1 FROM "role_permissions" WHERE "role_id" = ${adminRoleId} AND "permission_id" = ${permId}
            );
          `);
        }
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Delete permissions for role resource
    // This will cascade delete from role_permissions
    await queryRunner.query(`
        DELETE FROM "permissions" WHERE "resource" = 'role'
    `);
  }
}
