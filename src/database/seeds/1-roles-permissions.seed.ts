import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import * as bcrypt from 'bcrypt';
import { DataSource } from 'typeorm';

import { User } from '../../modules/auth/entities/user.entity';
import { Permission } from '../../modules/rbac/entities/permission.entity';
import { Role } from '../../modules/rbac/entities/role.entity';

export async function seedRolesAndPermissions(dataSource: DataSource) {
  const roleRepository = dataSource.getRepository(Role);
  const permissionRepository = dataSource.getRepository(Permission);

  console.log('🌱 Seeding roles and permissions...');

  const filePath = resolve(__dirname, 'data/permissions.json');

  const permissionsData = JSON.parse(
    readFileSync(filePath, 'utf-8'),
  ) as Permission[];

  const permissions: Permission[] = [];
  for (const permData of permissionsData) {
    let permission = await permissionRepository.findOne({
      where: { resource: permData.resource, action: permData.action },
    });

    if (!permission) {
      permission = permissionRepository.create(permData);
      await permissionRepository.save(permission);
    }

    permissions.push(permission);
  }

  console.log(`✅ Created ${permissions.length} permissions`);

  // Create roles
  const adminPermissions = permissions; // Admin has all permissions
  const userPermissions = permissions.filter((p) =>
    [
      'problem:read',
      'submission:create',
      'submission:read',
      'contest:read',
      'contest:join',
      'user:read',
      'user:update',
      'ai:interview',
      'ai:hint',
      'post:create',
      'post:update',
      'comment:create',
      'payment:create',
      'language:read',
      'study_plan:read',
    ].includes(`${p.resource}:${p.action}`),
  );

  // Admin role
  let adminRole = await roleRepository.findOne({
    where: { slug: 'admin' },
    relations: ['permissions'],
  });
  if (!adminRole) {
    adminRole = roleRepository.create({
      name: 'Admin',
      slug: 'admin',
      description: 'Full system access',
      isSystemRole: true,
      priority: 100,
      permissions: adminPermissions,
    });
    await roleRepository.save(adminRole);
    console.log('✅ Created Admin role');
  } else {
    adminRole.permissions = adminPermissions;
    await roleRepository.save(adminRole);
    console.log('✅ Updated Admin role permissions');
  }

  // User role
  let userRole = await roleRepository.findOne({
    where: { slug: 'user' },
    relations: ['permissions'],
  });
  if (!userRole) {
    userRole = roleRepository.create({
      name: 'User',
      slug: 'user',
      description: 'Default role for registered users',
      isSystemRole: true,
      priority: 10,
      permissions: userPermissions,
    });
    await roleRepository.save(userRole);
    console.log('✅ Created User role');
  } else {
    userRole.permissions = userPermissions;
    await roleRepository.save(userRole);
    console.log('✅ Updated User role permissions');
  }

  console.log('✅ Roles and permissions seeded successfully\n');

  // Create admin account
  const userRepository = dataSource.getRepository(User);
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminUsername = process.env.ADMIN_USERNAME;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminEmail || !adminUsername || !adminPassword) {
    console.log(
      '⚠️  Admin account environment variables not set. Skipping admin creation.\n',
    );
    return;
  }

  let adminUser = await userRepository.findOne({
    where: [{ email: adminEmail }, { username: adminUsername }],
  });

  if (!adminUser) {
    const saltRounds = Number.parseInt(process.env.BCRYPT_SALT_ROUNDS!, 10);
    const passwordHash = await bcrypt.hash(adminPassword, saltRounds);

    adminUser = userRepository.create({
      email: adminEmail,
      username: adminUsername,
      passwordHash,
      fullName: 'System Administrator',
      emailVerified: true,
      isActive: true,
      isBanned: false,
      isPremium: true,
      premiumStartedAt: new Date(),
      premiumExpiresAt: new Date(
        Date.now() + 99 * 12 * 30 * 24 * 60 * 60 * 1000, // 99 years (if you are more than 99 years old, please contact me)
      ),
      role: adminRole,
    });

    await userRepository.save(adminUser);
    console.log(`✅ Created admin account: ${adminEmail}\n`);
  } else {
    console.log(`ℹ️  Admin account already exists: ${adminEmail}\n`);
  }
}
