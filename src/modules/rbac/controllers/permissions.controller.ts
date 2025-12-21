import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Query,
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
import { QueryPermissionsDto } from '../dto/query-permissions.dto';
import { Permission } from '../entities/permission.entity';
import { RbacService } from '../rbac.service';

@ApiTags('Permissions')
@ApiBearerAuth()
@Controller('permissions')
@UseGuards(CaslGuard)
export class PermissionsController {
  constructor(private readonly rbacService: RbacService) {}

  @Get()
  @CheckAbility({ action: Action.Read, subject: 'Permission' })
  @ApiOperation({
    summary: 'Get all permissions',
    description:
      'Retrieve all permissions. Optionally filter by resource name. Permissions are read-only and managed via database migrations.',
  })
  @ApiResponse({
    status: 200,
    description: 'List of all permissions',
    type: [Permission],
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - insufficient permissions',
  })
  async getAllPermissions(
    @Query() query: QueryPermissionsDto,
  ): Promise<Permission[]> {
    if (query.resource) {
      return this.rbacService.getPermissionsByResource(query.resource);
    }
    return this.rbacService.getAllPermissions();
  }

  @Get(':id')
  @CheckAbility({ action: Action.Read, subject: 'Permission' })
  @ApiOperation({ summary: 'Get permission by ID' })
  @ApiParam({ name: 'id', description: 'Permission ID', type: Number })
  @ApiResponse({
    status: 200,
    description: 'Permission details',
    type: Permission,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - insufficient permissions',
  })
  @ApiResponse({ status: 404, description: 'Permission not found' })
  async getPermissionById(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<Permission> {
    return this.rbacService.getPermissionById(id);
  }

  @Get('resource/:resource')
  @CheckAbility({ action: Action.Read, subject: 'Permission' })
  @ApiOperation({ summary: 'Get permissions by resource name' })
  @ApiParam({
    name: 'resource',
    description: 'Resource name (e.g., problem, contest, submission)',
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: 'List of permissions for the specified resource',
    type: [Permission],
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - insufficient permissions',
  })
  async getPermissionsByResource(
    @Param('resource') resource: string,
  ): Promise<Permission[]> {
    return this.rbacService.getPermissionsByResource(resource);
  }
}
