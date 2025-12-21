import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Transactional } from 'typeorm-transactional';
import { User } from '../auth/entities/user.entity';
import {
  Action,
  CaslAbilityFactory,
  Subjects,
} from './casl/casl-ability.factory';
import { Permission } from './entities/permission.entity';
import { Role } from './entities/role.entity';

@Injectable()
export class RbacService {
  constructor(
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
    @InjectRepository(Permission)
    private readonly permissionRepository: Repository<Permission>,
    private readonly caslAbilityFactory: CaslAbilityFactory,
  ) {}

  // ==================== ROLES ====================

  /**
   * Create a new role
   */
  @Transactional()
  async createRole(
    name: string,
    slug: string,
    description?: string,
    isSystemRole = false,
    priority = 0,
  ): Promise<Role> {
    const existingRole = await this.roleRepository.findOne({
      where: [{ name }, { slug }],
    });

    if (existingRole) {
      throw new ConflictException('Role with this name or slug already exists');
    }

    const role = this.roleRepository.create({
      name,
      slug,
      description,
      isSystemRole,
      priority,
    });

    return this.roleRepository.save(role);
  }

  /**
   * Get all roles
   */
  async getAllRoles(): Promise<Role[]> {
    return this.roleRepository.find({
      relations: ['permissions'],
      order: { priority: 'DESC', name: 'ASC' },
    });
  }

  /**
   * Get role by ID
   */
  async getRoleById(id: number): Promise<Role> {
    const role = await this.roleRepository.findOne({
      where: { id },
      relations: ['permissions'],
    });

    if (!role) {
      throw new NotFoundException(`Role with ID ${id} not found`);
    }

    return role;
  }

  /**
   * Get role by slug
   */
  async getRoleBySlug(slug: string): Promise<Role> {
    const role = await this.roleRepository.findOne({
      where: { slug },
      relations: ['permissions'],
    });

    if (!role) {
      throw new NotFoundException(`Role with slug ${slug} not found`);
    }

    return role;
  }

  /**
   * Update role
   */
  @Transactional()
  async updateRole(id: number, updates: Partial<Role>): Promise<Role> {
    const role = await this.getRoleById(id);

    if (role.isSystemRole && updates.isSystemRole === false) {
      throw new BadRequestException('Cannot modify system role status');
    }

    Object.assign(role, updates);
    return this.roleRepository.save(role);
  }

  /**
   * Delete role
   */
  @Transactional()
  async deleteRole(id: number): Promise<void> {
    const role = await this.getRoleById(id);

    if (role.isSystemRole) {
      throw new BadRequestException('Cannot delete system role');
    }

    await this.roleRepository.remove(role);
  }

  /**
   * Assign permissions to role
   */
  @Transactional()
  async assignPermissionsToRole(
    roleId: number,
    permissionIds: number[],
  ): Promise<Role> {
    const role = await this.getRoleById(roleId);

    if (role.isSystemRole) {
      throw new BadRequestException('Cannot modify system role permissions');
    }

    const permissions = await this.permissionRepository.findBy({
      id: In(permissionIds),
    });

    if (permissions.length !== permissionIds.length) {
      throw new NotFoundException('One or more permissions not found');
    }

    role.permissions = permissions;
    return this.roleRepository.save(role);
  }

  /**
   * Remove permissions from role
   */
  @Transactional()
  async removePermissionsFromRole(
    roleId: number,
    permissionIds: number[],
  ): Promise<Role> {
    const role = await this.getRoleById(roleId);

    if (role.isSystemRole) {
      throw new BadRequestException('Cannot modify system role permissions');
    }

    role.permissions = role.permissions.filter(
      (permission) => !permissionIds.includes(permission.id),
    );

    return this.roleRepository.save(role);
  }

  // ==================== PERMISSIONS ====================

  /**
   * Create a new permission
   */
  @Transactional()
  async createPermission(
    resource: string,
    action: string,
    description?: string,
  ): Promise<Permission> {
    const existingPermission = await this.permissionRepository.findOne({
      where: { resource, action },
    });

    if (existingPermission) {
      throw new ConflictException(
        'Permission with this resource and action already exists',
      );
    }

    const permission = this.permissionRepository.create({
      resource,
      action,
      description,
    });

    return this.permissionRepository.save(permission);
  }

  /**
   * Get all permissions
   */
  async getAllPermissions(): Promise<Permission[]> {
    return this.permissionRepository.find({
      order: { resource: 'ASC', action: 'ASC' },
    });
  }

  /**
   * Get permission by ID
   */
  async getPermissionById(id: number): Promise<Permission> {
    const permission = await this.permissionRepository.findOne({
      where: { id },
    });

    if (!permission) {
      throw new NotFoundException(`Permission with ID ${id} not found`);
    }

    return permission;
  }

  /**
   * Get permissions by resource
   */
  async getPermissionsByResource(resource: string): Promise<Permission[]> {
    return this.permissionRepository.find({
      where: { resource },
      order: { action: 'ASC' },
    });
  }

  /**
   * Delete permission
   */
  async deletePermission(id: number): Promise<void> {
    const permission = await this.getPermissionById(id);
    await this.permissionRepository.remove(permission);
  }

  /**
   * Get user permissions (from their role)
   */
  async getUserPermissions(roleId: number): Promise<Permission[]> {
    const role = await this.getRoleById(roleId);
    return role.permissions;
  }

  /**
   * Check if user has permission
   */
  async userHasPermission(
    roleId: number,
    resource: string,
    action: string,
  ): Promise<boolean> {
    const permissions = await this.getUserPermissions(roleId);
    return permissions.some(
      (p) => p.resource === resource && p.action === action,
    );
  }

  // ==================== CASL INTEGRATION ====================

  /**
   * Check if user can perform action on subject using CASL
   */
  canUserPerformAction(
    user: User,
    action: Action,
    subject: Subjects,
    conditions?: string,
  ): boolean {
    const ability = this.caslAbilityFactory.createForUser(user);
    return conditions
      ? ability.can(action, subject, conditions)
      : ability.can(action, subject);
  }

  /**
   * Check if user can perform action on subject instance using CASL
   */
  canUserPerformActionOnInstance<T extends Subjects>(
    user: User,
    action: Action,
    subjectInstance: T,
  ): boolean {
    const ability = this.caslAbilityFactory.createForUser(user);
    return ability.can(action, subjectInstance);
  }

  /**
   * Get user's CASL ability
   */
  getUserAbility(user: User) {
    return this.caslAbilityFactory.createForUser(user);
  }

  /**
   * Get all actions user can perform on a subject
   */
  getUserActionsForSubject(user: User, subject: Subjects): Action[] {
    const ability = this.caslAbilityFactory.createForUser(user);
    const possibleActions = Object.values(Action);

    return possibleActions.filter((action) => ability.can(action, subject));
  }

  /**
   * Check multiple permissions at once
   */
  checkMultiplePermissions(
    user: User,
    checks: Array<{ action: Action; subject: Subjects; conditions?: string }>,
  ): boolean[] {
    const ability = this.caslAbilityFactory.createForUser(user);

    return checks.map((check) =>
      check.conditions
        ? ability.can(check.action, check.subject, check.conditions)
        : ability.can(check.action, check.subject),
    );
  }

  /**
   * Get permission summary for a user
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  async getUserPermissionSummary(user: User): Promise<{
    roleSlug: string;
    roleName: string;
    permissions: string[];
    canManageAll: boolean;
  }> {
    if (!user.role) {
      return {
        roleSlug: 'none',
        roleName: 'No Role',
        permissions: [],
        canManageAll: false,
      };
    }

    const ability = this.caslAbilityFactory.createForUser(user);
    const canManageAll = ability.can(Action.Manage, 'all');

    const permissionStrings = user.role.permissions.map(
      (p) => `${p.resource}:${p.action}`,
    );

    return {
      roleSlug: user.role.slug,
      roleName: user.role.name,
      permissions: permissionStrings,
      canManageAll,
    };
  }
}
