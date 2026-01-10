import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags, ApiQuery } from '@nestjs/swagger';
import { Public } from '../../../common/decorators/public.decorator';
import { Language } from '../../../common/decorators/language.decorator';
import { SubscriptionPlanDto } from '../dto/subscription-plan.dto';
import { SubscriptionPlansService } from '../services/subscription-plans.service';

@ApiTags('Subscription Plans')
@Controller('subscription-plans')
export class SubscriptionPlansController {
  constructor(private readonly plansService: SubscriptionPlansService) {}

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
    return this.plansService.getPlans(lang);
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
}
