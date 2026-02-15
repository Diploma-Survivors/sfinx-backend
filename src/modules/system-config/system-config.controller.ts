import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Put,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CheckPolicies } from '../../common';
import { CaslGuard } from '../auth/guards/casl.guard';
import { Action } from '../rbac/casl';
import { UpsertSystemParameterDto } from './dto/upsert-system-parameter.dto';
import { SystemParameter } from './entities/system-parameter.entity';
import { SystemConfigService } from './system-config.service';

@ApiTags('Admin - System Config')
@Controller('admin/system-config')
@UseGuards(CaslGuard)
@ApiBearerAuth('JWT-auth')
export class SystemConfigController {
  constructor(private readonly systemConfigService: SystemConfigService) {}

  @Get()
  @CheckPolicies((ability) => ability.can(Action.Access, 'Admin'))
  @ApiOperation({ summary: 'List all system parameters' })
  @ApiResponse({ status: 200, type: [SystemParameter] })
  findAll(): Promise<SystemParameter[]> {
    return this.systemConfigService.findAll();
  }

  @Get(':key')
  @CheckPolicies((ability) => ability.can(Action.Access, 'Admin'))
  @ApiOperation({ summary: 'Get a single system parameter by key' })
  @ApiParam({ name: 'key', description: 'Parameter key', type: String })
  @ApiResponse({ status: 200, type: SystemParameter })
  @ApiResponse({ status: 404, description: 'Parameter not found' })
  findOne(@Param('key') key: string): Promise<SystemParameter> {
    return this.systemConfigService.findOne(key);
  }

  @Put(':key')
  @CheckPolicies((ability) => ability.can(Action.Access, 'Admin'))
  @ApiOperation({ summary: 'Create or update a system parameter' })
  @ApiParam({ name: 'key', description: 'Parameter key', type: String })
  @ApiResponse({ status: 200, type: SystemParameter })
  upsert(
    @Param('key') key: string,
    @Body() dto: UpsertSystemParameterDto,
  ): Promise<SystemParameter> {
    return this.systemConfigService.upsert(key, dto);
  }

  @Delete(':key')
  @CheckPolicies((ability) => ability.can(Action.Access, 'Admin'))
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a system parameter' })
  @ApiParam({ name: 'key', description: 'Parameter key', type: String })
  @ApiResponse({ status: 204, description: 'Deleted successfully' })
  @ApiResponse({ status: 404, description: 'Parameter not found' })
  remove(@Param('key') key: string): Promise<void> {
    return this.systemConfigService.remove(key);
  }
}
