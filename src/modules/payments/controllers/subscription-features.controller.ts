import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CheckPolicies } from '../../../common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { SubscriptionFeatureService } from '../services/subscription-feature.service';
import {
  CreateSubscriptionFeatureDto,
  UpdateSubscriptionFeatureDto,
} from '../dto/create-subscription-feature.dto';
import { SubscriptionFeature } from '../entities/subscription-feature.entity';
import { CaslGuard } from '../../auth/guards/casl.guard';
import { Action } from '../../rbac/casl';

@ApiTags('Subscription Features')
@Controller('subscription-features')
export class SubscriptionFeaturesController {
  constructor(private readonly featureService: SubscriptionFeatureService) {}

  @Post()
  @UseGuards(CaslGuard)
  @ApiBearerAuth('JWT-auth')
  @CheckPolicies((ability) => ability.can(Action.Manage, SubscriptionFeature))
  @ApiOperation({ summary: 'Create a new subscription feature' })
  @ApiResponse({
    status: 201,
    description: 'Feature created successfully',
    type: SubscriptionFeature,
  })
  async create(
    @Body() dto: CreateSubscriptionFeatureDto,
  ): Promise<SubscriptionFeature> {
    return this.featureService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all active subscription features (Public)' })
  @ApiQuery({
    name: 'lang',
    required: false,
    description: 'Language code (e.g. en, vi)',
  })
  @ApiResponse({
    status: 200,
    description: 'List of features retrieved successfully',
    type: [SubscriptionFeature],
  })
  async findAll(@Query('lang') lang?: string): Promise<SubscriptionFeature[]> {
    return this.featureService.findAll(lang, true); // Public endpoint, only active features
  }

  @Get('all')
  @UseGuards(CaslGuard)
  @ApiBearerAuth('JWT-auth')
  @CheckPolicies((ability) => ability.can(Action.Manage, SubscriptionFeature))
  @ApiOperation({
    summary: 'List all subscription features (Admin - includes inactive)',
  })
  @ApiQuery({
    name: 'lang',
    required: false,
    description: 'Language code (e.g. en, vi)',
  })
  @ApiResponse({
    status: 200,
    description: 'List of all features retrieved successfully',
    type: [SubscriptionFeature],
  })
  async findAllAdmin(
    @Query('lang') lang?: string,
  ): Promise<SubscriptionFeature[]> {
    return this.featureService.findAll(lang, false);
  }

  @Put(':id')
  @UseGuards(CaslGuard)
  @ApiBearerAuth('JWT-auth')
  @UseGuards(CaslGuard)
  @ApiBearerAuth('JWT-auth')
  @CheckPolicies((ability) => ability.can(Action.Manage, SubscriptionFeature))
  @ApiOperation({ summary: 'Update a subscription feature' })
  @ApiResponse({
    status: 200,
    description: 'Feature updated successfully',
    type: SubscriptionFeature,
  })
  async update(
    @Param('id') id: number,
    @Body() dto: UpdateSubscriptionFeatureDto,
  ): Promise<SubscriptionFeature> {
    return this.featureService.update(id, dto);
  }

  @Get(':id')
  @UseGuards(CaslGuard)
  @ApiBearerAuth('JWT-auth')
  @CheckPolicies((ability) => ability.can(Action.Manage, SubscriptionFeature))
  @ApiOperation({ summary: 'Get a subscription feature by ID' })
  @ApiResponse({
    status: 200,
    description: 'Feature retrieved successfully',
    type: SubscriptionFeature,
  })
  async findOne(@Param('id') id: number): Promise<SubscriptionFeature> {
    return this.featureService.findOne(id);
  }

  @Delete(':id')
  @UseGuards(CaslGuard)
  @ApiBearerAuth('JWT-auth')
  @CheckPolicies((ability) => ability.can(Action.Manage, SubscriptionFeature))
  @ApiOperation({ summary: 'Delete a subscription feature' })
  @ApiResponse({
    status: 200,
    description: 'Feature deleted successfully',
  })
  async remove(@Param('id') id: number): Promise<void> {
    return this.featureService.remove(id);
  }
}
