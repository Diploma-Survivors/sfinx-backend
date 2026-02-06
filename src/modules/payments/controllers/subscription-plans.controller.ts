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
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CheckPolicies, Public } from '../../../common';
import { Language } from '../../../common/decorators/language.decorator';
import { SubscriptionPlanDto } from '../dto/subscription-plan.dto';
import { Action } from '../../rbac/casl';
import { CaslGuard } from '../../auth/guards/casl.guard';
import { SubscriptionPlan } from '../entities/subscription-plan.entity';
import { SubscriptionPlansService } from '../services/subscription-plans.service';
import { CreateSubscriptionPlanDto } from '../dto/create-subscription-plan.dto';
import { UpdateSubscriptionPlanDto } from '../dto/update-subscription-plan.dto';

@ApiTags('Subscription Plans')
@Controller('subscription-plans')
export class SubscriptionPlansController {
  constructor(private readonly plansService: SubscriptionPlansService) {}

  @Post()
  @UseGuards(CaslGuard)
  @CheckPolicies((ability) => ability.can(Action.Create, SubscriptionPlan))
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Create a new subscription plan' })
  @ApiResponse({ type: SubscriptionPlan })
  async create(
    @Body() dto: CreateSubscriptionPlanDto,
  ): Promise<SubscriptionPlan> {
    return this.plansService.create(dto);
  }

  @Get()
  @Public()
  @ApiOperation({ summary: 'List active subscription plans' })
  @ApiQuery({
    name: 'lang',
    required: false,
    description:
      'Language code (en, vi). Also supports Accept-Language header.',
    example: 'en',
  })
  @ApiResponse({ type: [SubscriptionPlanDto] })
  async getPlans(@Language() lang: string): Promise<SubscriptionPlanDto[]> {
    return this.plansService.getPlans(lang, true);
  }

  @Get('all')
  @UseGuards(CaslGuard)
  @CheckPolicies((ability) => ability.can(Action.Manage, SubscriptionPlan))
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'List all subscription plans (Admin - includes inactive)',
  })
  @ApiQuery({
    name: 'lang',
    required: false,
    description: 'Language code (en, vi)',
    example: 'en',
  })
  @ApiResponse({ type: [SubscriptionPlanDto] })
  async getAllPlans(@Language() lang: string): Promise<SubscriptionPlanDto[]> {
    return this.plansService.getPlans(lang, false);
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Get subscription plan details' })
  @ApiQuery({
    name: 'lang',
    required: false,
    description:
      'Language code (en, vi). Also supports Accept-Language header.',
    example: 'en',
  })
  @ApiResponse({ type: SubscriptionPlanDto })
  async getPlan(
    @Param('id', ParseIntPipe) id: number,
    @Language() lang: string,
  ): Promise<SubscriptionPlanDto> {
    return this.plansService.getPlan(id, lang);
  }

  @Get(':id/details')
  @UseGuards(CaslGuard)
  @CheckPolicies((ability) => ability.can(Action.Manage, SubscriptionPlan))
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Get subscription plan details (Admin - full info)',
  })
  @ApiResponse({ type: SubscriptionPlan })
  async findOne(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<SubscriptionPlan> {
    return this.plansService.findOne(id);
  }

  @Put(':id')
  @UseGuards(CaslGuard)
  @CheckPolicies((ability) => ability.can(Action.Update, SubscriptionPlan))
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Update a subscription plan' })
  @ApiResponse({ type: SubscriptionPlan })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSubscriptionPlanDto,
  ): Promise<SubscriptionPlan> {
    return this.plansService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(CaslGuard)
  @CheckPolicies((ability) => ability.can(Action.Delete, SubscriptionPlan))
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Delete a subscription plan' })
  @ApiResponse({ status: 200, description: 'Plan deleted successfully' })
  async remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.plansService.remove(id);
  }
}
