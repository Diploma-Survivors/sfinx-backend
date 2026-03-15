import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CheckPolicies } from '../../common';
import { CaslGuard } from '../auth/guards/casl.guard';
import { Action } from '../rbac/casl';
import { FetchNowDto } from './dto/fetch-now.dto';
import { QueryProviderCostsDto } from './dto/query-provider-costs.dto';
import { ProviderCostsService } from './provider-costs.service';

@ApiTags('Admin - Provider Costs')
@Controller('admin/provider-costs')
@UseGuards(CaslGuard)
@ApiBearerAuth('JWT-auth')
export class ProviderCostsController {
  private readonly logger = new Logger(ProviderCostsController.name);

  constructor(private readonly providerCostsService: ProviderCostsService) {}

  @Get()
  @CheckPolicies((ability) => ability.can(Action.Access, 'Admin'))
  @ApiOperation({ summary: 'List provider cost records (paginated)' })
  @ApiResponse({ status: 200, description: 'Paginated list of cost records' })
  getRecords(@Query() query: QueryProviderCostsDto) {
    return this.providerCostsService.getRecords(query);
  }

  @Get('summary')
  @CheckPolicies((ability) => ability.can(Action.Access, 'Admin'))
  @ApiOperation({ summary: 'Get aggregated cost summary by provider' })
  @ApiQuery({ name: 'from', required: true, example: '2024-01-01' })
  @ApiQuery({ name: 'to', required: true, example: '2024-01-31' })
  @ApiQuery({ name: 'currency', required: false, example: 'USD' })
  getSummary(
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('currency') currency = 'USD',
  ) {
    return this.providerCostsService.getSummary(from, to, currency);
  }

  @Post('fetch-now')
  @CheckPolicies((ability) => ability.can(Action.Access, 'Admin'))
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Manually trigger a cost fetch for a specific date',
  })
  @ApiResponse({ status: 202, description: 'Fetch triggered asynchronously' })
  fetchNow(@Body() dto: FetchNowDto) {
    const date = new Date(dto.date);
    this.providerCostsService
      .fetchAndStoreForDate(date)
      .catch((err) => this.logger.error('Manual fetch-now failed', err));
    return { message: `Fetch triggered for ${dto.date}`, date: dto.date };
  }
}
