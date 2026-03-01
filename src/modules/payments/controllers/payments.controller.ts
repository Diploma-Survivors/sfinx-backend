import {
  Body,
  Controller,
  Get,
  Ip,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { CheckPolicies, GetUser } from '../../../common';
import { User } from '../../auth/entities/user.entity';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PaymentsService } from '../services/payments.service';
import { ConfigService } from '@nestjs/config';
import { CreatePaymentDto } from '../dto/create-payment.dto';
import { VnpayCallbackDto } from '../dto/vnpay-callback.dto';
import { PaymentHistoryResponseDto } from '../dto/payment-history-response.dto';
import { CurrentPlanResponseDto } from '../dto/current-plan-response.dto';
import { CaslGuard } from '../../auth/guards/casl.guard';
import { Action } from '../../rbac/casl';
import { PaymentTransaction } from '../entities/payment-transaction.entity';
import { TransactionFilterDto } from '../dto/transaction-filter.dto';
import { RevenueStatsQueryDto } from '../dto/revenue-stats-query.dto';
import { RevenueStatsResponseDto } from '../dto/revenue-stats-response.dto';
import { Language } from '../../auth/enums';
import { PaymentMethodService } from '../services/payment-method.service';
import { PaymentMethodEnum } from '../enums/payment-method.enum';

@ApiTags('Payments')
@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly configService: ConfigService,
    private readonly paymentMethodService: PaymentMethodService,
  ) {}

  @Get('methods')
  @ApiOperation({ summary: 'Get active payment methods' })
  @ApiOkResponse({
    description: 'List of active payment methods',
  })
  async getPaymentMethods(@Query('lang') lang?: string) {
    return this.paymentMethodService.getActivePaymentMethods(lang);
  }

  @Post('create')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Create a payment URL' })
  @ApiBody({ type: CreatePaymentDto })
  @ApiOkResponse({
    description: 'Payment URL generated successfully',
    schema: {
      type: 'object',
      properties: {
        url: { type: 'string', example: 'https://sandbox.vnpayment.vn/...' },
      },
    },
  })
  @ApiNotFoundResponse({
    description: 'Subscription plan not found or inactive',
  })
  async createPayment(
    @GetUser() user: User,
    @Body() createPaymentDto: CreatePaymentDto,
    @Ip() ip: string,
    @Req() req: Request,
  ): Promise<{ url: string }> {
    const clientIp = ip || req.ip || '127.0.0.1';
    const url = await this.paymentsService.createPaymentUrl(
      user,
      createPaymentDto.planId,
      clientIp,
      createPaymentDto.paymentMethod,
    );
    return { url };
  }

  @Get('vnpay/return')
  @ApiOperation({ summary: 'Handle VNPAY return redirect' })
  @ApiOkResponse({ description: 'Redirects to frontend success/fail page' })
  async handleVnpayReturn(
    @Query() query: VnpayCallbackDto,
    @Res() res: Response,
  ): Promise<void> {
    const result = await this.paymentsService.handlePaymentCallback(
      query,
      PaymentMethodEnum.VNPAY,
    );

    // Redirect to Frontend
    const frontendUrl = this.configService.get<string>('FRONTEND_URL');

    if (result.success) {
      res.redirect(`${frontendUrl}/payment/success`);
    } else {
      res.redirect(
        `${frontendUrl}/payment/failed?message=${encodeURIComponent(result.message || 'Unknown error')}`,
      );
    }
  }

  @Get('vnpay/ipn')
  @ApiOperation({ summary: 'Handle VNPAY IPN (Instant Payment Notification)' })
  @ApiOkResponse({
    description: 'Returns VNPAY standard response',
    schema: {
      type: 'object',
      properties: {
        RspCode: { type: 'string', example: '00' },
        Message: { type: 'string', example: 'Success' },
      },
    },
  })
  async handleVnpayIpn(
    @Query() query: VnpayCallbackDto,
  ): Promise<{ RspCode: string; Message: string }> {
    try {
      const result = await this.paymentsService.handlePaymentCallback(
        query,
        PaymentMethodEnum.VNPAY,
      );
      if (result.success) {
        return { RspCode: '00', Message: 'Success' };
      } else {
        return { RspCode: '99', Message: 'Fail' }; // Simplified error code
      }
    } catch {
      return { RspCode: '99', Message: 'Unknown Error' };
    }
  }

  @Get('history')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get payment history' })
  @ApiOkResponse({ type: [PaymentHistoryResponseDto] })
  async getPaymentHistory(
    @GetUser() user: User,
  ): Promise<PaymentHistoryResponseDto[]> {
    return this.paymentsService.getPaymentHistory(user);
  }

  @Get('current-plan')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get current subscription plan' })
  @ApiOkResponse({ type: CurrentPlanResponseDto })
  async getCurrentPlan(
    @GetUser() user: User,
  ): Promise<CurrentPlanResponseDto | null> {
    return this.paymentsService.getCurrentPlan(user);
  }

  @Get('transactions')
  @UseGuards(CaslGuard)
  @ApiBearerAuth('JWT-auth')
  @CheckPolicies((ability) => ability.can(Action.Manage, PaymentTransaction))
  @ApiOperation({ summary: 'Get payment transactions (Admin)' })
  @ApiResponse({ status: 200, description: 'Paginated list of transactions' })
  async getTransactions(
    @Query() filter: TransactionFilterDto,
    @GetUser() user: User,
  ) {
    const lang = user.preferredLanguage || Language.EN;
    return this.paymentsService.getAllTransactions(filter, lang);
  }

  @Get('stats')
  @UseGuards(CaslGuard)
  @ApiBearerAuth('JWT-auth')
  @CheckPolicies((ability) => ability.can(Action.Manage, PaymentTransaction))
  @ApiOperation({ summary: 'Get revenue and subscription statistics' })
  @ApiResponse({ status: 200, description: 'Revenue statistics' })
  async getStats(
    @Query() query: RevenueStatsQueryDto,
    @GetUser() user: User,
  ): Promise<RevenueStatsResponseDto> {
    const lang = user.preferredLanguage || Language.EN;
    return this.paymentsService.getRevenueStats(query, lang);
  }
}
