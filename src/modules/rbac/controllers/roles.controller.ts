import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CheckAbility } from '../../../common';
import { CaslGuard } from '../../auth/guards/casl.guard';
import { Action } from '../casl/casl-ability.factory';
import { AssignPermissionsDto } from '../dto/assign-permissions.dto';
import { CreateRoleDto } from '../dto/create-role.dto';
import { UpdateRoleDto } from '../dto/update-role.dto';
import { Role } from '../entities/role.entity';
import { RbacService } from '../rbac.service';

@ApiTags('Roles')
@ApiBearerAuth()
@Controller('roles')
@UseGuards(CaslGuard)
export class RolesController {
  constructor(private readonly rbacService: RbacService) {}

  @Get()
  @CheckAbility({ action: Action.Read, subject: 'Role' })
  @ApiOperation({ summary: 'Get all roles' })
  @ApiResponse({
    status: 200,
    description: 'List of all roles with their permissions',
    type: [Role],
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - insufficient permissions',
  })
  async getAllRoles(): Promise<Role[]> {
    return this.rbacService.getAllRoles();
  }

  @Get(':id')
  @CheckAbility({ action: Action.Read, subject: 'Role' })
  @ApiOperation({ summary: 'Get role by ID' })
  @ApiParam({ name: 'id', description: 'Role ID', type: Number })
  @ApiResponse({
    status: 200,
    description: 'Role details with permissions',
    type: Role,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - insufficient permissions',
  })
  @ApiResponse({ status: 404, description: 'Role not found' })
  async getRoleById(@Param('id', ParseIntPipe) id: number): Promise<Role> {
    return this.rbacService.getRoleById(id);
  }

  @Post()
  @CheckAbility({ action: Action.Create, subject: 'Role' })
  @ApiOperation({ summary: 'Create a new role' })
  @ApiResponse({
    status: 201,
    description: 'Role created successfully',
    type: Role,
  })
  @ApiResponse({ status: 400, description: 'Bad request - validation failed' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - insufficient permissions',
  })
  @ApiResponse({ status: 409, description: 'Conflict - role already exists' })
  async createRole(@Body() createRoleDto: CreateRoleDto): Promise<Role> {
    return this.rbacService.createRole(
      createRoleDto.name,
      createRoleDto.slug,
      createRoleDto.description,
      false, // isSystemRole - only set via seeds/migrations
      createRoleDto.priority || 0,
    );
  }

  @Patch(':id')
  @CheckAbility({ action: Action.Update, subject: 'Role' })
  @ApiOperation({ summary: 'Update a role' })
  @ApiParam({ name: 'id', description: 'Role ID', type: Number })
  @ApiResponse({
    status: 200,
    description: 'Role updated successfully',
    type: Role,
  })
  @ApiResponse({ status: 400, description: 'Bad request - validation failed' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - insufficient permissions',
  })
  @ApiResponse({ status: 404, description: 'Role not found' })
  async updateRole(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateRoleDto: UpdateRoleDto,
  ): Promise<Role> {
    return this.rbacService.updateRole(id, updateRoleDto);
  }

  @Delete(':id')
  @CheckAbility({ action: Action.Delete, subject: 'Role' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a role' })
  @ApiParam({ name: 'id', description: 'Role ID', type: Number })
  @ApiResponse({ status: 204, description: 'Role deleted successfully' })
  @ApiResponse({
    status: 400,
    description: 'Bad request - cannot delete system role',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - insufficient permissions',
  })
  @ApiResponse({ status: 404, description: 'Role not found' })
  async deleteRole(@Param('id', ParseIntPipe) id: number): Promise<void> {
    await this.rbacService.deleteRole(id);
  }

  @Post(':id/permissions')
  @CheckAbility({ action: Action.Manage, subject: 'Role' })
  @ApiOperation({ summary: 'Assign permissions to a role' })
  @ApiParam({ name: 'id', description: 'Role ID', type: Number })
  @ApiResponse({
    status: 200,
    description: 'Permissions assigned successfully',
    type: Role,
  })
  @ApiResponse({ status: 400, description: 'Bad request - validation failed' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - insufficient permissions',
  })
  @ApiResponse({ status: 404, description: 'Role or permissions not found' })
  async assignPermissions(
    @Param('id', ParseIntPipe) id: number,
    @Body() assignPermissionsDto: AssignPermissionsDto,
  ): Promise<Role> {
    return this.rbacService.assignPermissionsToRole(
      id,
      assignPermissionsDto.permissionIds,
    );
  }

  @Delete(':id/permissions')
  @CheckAbility({ action: Action.Manage, subject: 'Role' })
  @ApiOperation({ summary: 'Remove permissions from a role' })
  @ApiParam({ name: 'id', description: 'Role ID', type: Number })
  @ApiResponse({
    status: 200,
    description: 'Permissions removed successfully',
    type: Role,
  })
  @ApiResponse({ status: 400, description: 'Bad request - validation failed' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - insufficient permissions',
  })
  @ApiResponse({ status: 404, description: 'Role not found' })
  async removePermissions(
    @Param('id', ParseIntPipe) id: number,
    @Body() assignPermissionsDto: AssignPermissionsDto,
  ): Promise<Role> {
    return this.rbacService.removePermissionsFromRole(
      id,
      assignPermissionsDto.permissionIds,
    );
  }
}
