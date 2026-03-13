import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CheckPolicies } from '../../../common';
import { CaslGuard } from '../../auth/guards/casl.guard';
import { Action } from '../../rbac/casl';
import { FeeConfig } from '../entities/fee-config.entity';
import { FeeConfigService } from '../services/fee-config.service';
import { CreateFeeConfigDto } from '../dto/create-fee-config.dto';
import { UpdateFeeConfigDto } from '../dto/update-fee-config.dto';

@ApiTags('Fee Configs')
@Controller('fee-configs')
export class FeeConfigsController {
  constructor(private readonly feeConfigService: FeeConfigService) {}

  @Get()
  @UseGuards(CaslGuard)
  @CheckPolicies((ability) => ability.can(Action.Manage, 'Payment'))
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'List active fee configs (Admin)' })
  @ApiResponse({ status: 200, type: [FeeConfig] })
  async getActiveFees(): Promise<FeeConfig[]> {
    return this.feeConfigService.getActiveFees();
  }

  @Get('all')
  @UseGuards(CaslGuard)
  @CheckPolicies((ability) => ability.can(Action.Manage, 'Payment'))
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'List all fee configs including inactive (Admin)' })
  @ApiResponse({ status: 200, type: [FeeConfig] })
  async findAll(): Promise<FeeConfig[]> {
    return this.feeConfigService.findAll();
  }

  @Post()
  @UseGuards(CaslGuard)
  @CheckPolicies((ability) => ability.can(Action.Manage, 'Payment'))
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Create a fee config (Admin)' })
  @ApiResponse({ status: 201, type: FeeConfig })
  async create(@Body() dto: CreateFeeConfigDto): Promise<FeeConfig> {
    return this.feeConfigService.create(dto);
  }

  @Put(':id')
  @UseGuards(CaslGuard)
  @CheckPolicies((ability) => ability.can(Action.Manage, 'Payment'))
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Update a fee config (Admin)' })
  @ApiResponse({ status: 200, type: FeeConfig })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateFeeConfigDto,
  ): Promise<FeeConfig> {
    return this.feeConfigService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(CaslGuard)
  @CheckPolicies((ability) => ability.can(Action.Manage, 'Payment'))
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Delete a fee config (Admin)' })
  @ApiResponse({ status: 200 })
  async remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.feeConfigService.remove(id);
  }
}
