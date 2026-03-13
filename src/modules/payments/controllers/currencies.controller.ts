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
import { CheckPolicies, Public } from '../../../common';
import { CaslGuard } from '../../auth/guards/casl.guard';
import { Action } from '../../rbac/casl';
import { Currency } from '../entities/currency.entity';
import { CurrencyService } from '../services/currency.service';
import { CreateCurrencyDto } from '../dto/create-currency.dto';
import { UpdateCurrencyDto } from '../dto/update-currency.dto';

@ApiTags('Currencies')
@Controller('currencies')
export class CurrenciesController {
  constructor(private readonly currencyService: CurrencyService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'List active currencies' })
  @ApiResponse({ status: 200, type: [Currency] })
  async getActiveCurrencies(): Promise<Currency[]> {
    return this.currencyService.getActiveCurrencies();
  }

  @Get('all')
  @UseGuards(CaslGuard)
  @CheckPolicies((ability) => ability.can(Action.Manage, 'Payment'))
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'List all currencies including inactive (Admin)' })
  @ApiResponse({ status: 200, type: [Currency] })
  async findAll(): Promise<Currency[]> {
    return this.currencyService.findAll();
  }

  @Post()
  @UseGuards(CaslGuard)
  @CheckPolicies((ability) => ability.can(Action.Manage, 'Payment'))
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Create a currency (Admin)' })
  @ApiResponse({ status: 201, type: Currency })
  async create(@Body() dto: CreateCurrencyDto): Promise<Currency> {
    return this.currencyService.create(dto);
  }

  @Put(':id')
  @UseGuards(CaslGuard)
  @CheckPolicies((ability) => ability.can(Action.Manage, 'Payment'))
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Update a currency (Admin)' })
  @ApiResponse({ status: 200, type: Currency })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCurrencyDto,
  ): Promise<Currency> {
    return this.currencyService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(CaslGuard)
  @CheckPolicies((ability) => ability.can(Action.Manage, 'Payment'))
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Delete a currency (Admin)' })
  @ApiResponse({ status: 200 })
  async remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.currencyService.remove(id);
  }
}
