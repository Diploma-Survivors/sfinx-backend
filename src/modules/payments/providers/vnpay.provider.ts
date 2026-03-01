import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import * as qs from 'qs';
import { PaymentTransaction } from '../entities/payment-transaction.entity';
import { PaymentMethodEnum } from '../enums/payment-method.enum';
import {
  PaymentProvider,
  VerifyReturnUrlResult,
} from '../interfaces/payment-provider.interface';
import { VnpayConfig } from '../../../config/vnpay.config';

@Injectable()
export class VnPayProvider implements PaymentProvider {
  private readonly logger = new Logger(VnPayProvider.name);

  constructor(private readonly configService: ConfigService) {}

  getProviderName(): PaymentMethodEnum {
    return PaymentMethodEnum.VNPAY;
  }

  private getConfig(): VnpayConfig {
    return this.configService.getOrThrow<VnpayConfig>('vnpay');
  }

  /* eslint-disable @typescript-eslint/require-await */
  async createPaymentUrl(
    transaction: PaymentTransaction,
    ipAddr: string,
  ): Promise<string> {
    const config = this.getConfig();
    const date = new Date();
    const createDate = this.formatDate(date);
    const orderId = transaction.id.toString();

    // Use fallback IP if needed, similar to reference
    const clientIp = ipAddr === '::1' || !ipAddr ? '127.0.0.1' : ipAddr;

    const vnpParams = this.buildVnpParams(
      config,
      orderId,
      transaction.amountVnd * 100,
      clientIp,
      createDate,
      transaction.description,
    );

    // Generate secure hash using helper
    const paramsWithHash: Record<string, string> = {
      ...vnpParams,
      vnp_SecureHash: this.generateSecureHash(vnpParams, config.secretKey),
    };

    // Generate final URL
    const finalQuery = qs.stringify(paramsWithHash, { encode: false });
    return `${config.url}?${finalQuery}`;
  }

  async verifyReturnUrl(
    query: Record<string, string | number | boolean>,
  ): Promise<VerifyReturnUrlResult> {
    const config = this.getConfig();
    const secureHash = query['vnp_SecureHash'] as string;

    // Remove secure hash and params
    const vnpParams: Record<string, string | number | boolean> = {};
    Object.keys(query).forEach((key) => {
      if (key !== 'vnp_SecureHash' && key !== 'vnp_SecureHashType') {
        vnpParams[key] = query[key];
      }
    });

    // Use sortObject to get encoded params for signing
    const sortedParams = this.sortObject(vnpParams);
    const signed = this.generateSecureHash(sortedParams, config.secretKey);

    if (secureHash === signed) {
      // Signature checks out
      const responseCode = vnpParams['vnp_ResponseCode'] as string;
      const isSuccess = responseCode === '00';

      return {
        isSuccess,
        transactionId: vnpParams['vnp_TxnRef'] as string,
        message: isSuccess ? 'Success' : `Failed (Code: ${responseCode})`,
        bankCode: vnpParams['vnp_CardType'] as string,
        cardType: vnpParams['vnp_CardType'] as string,
      };
    } else {
      return {
        isSuccess: false,
        message: 'Invalid Signature',
      };
    }
  }

  private buildVnpParams(
    config: VnpayConfig,
    orderId: string,
    amount: number,
    ipAddress: string,
    createDate: string,
    description?: string,
  ): Record<string, string> {
    const vnpParams: Record<string, string | number> = {
      vnp_Version: '2.1.0',
      vnp_Command: 'pay',
      vnp_TmnCode: config.tmnCode?.trim() ?? '',
      vnp_Locale: 'vn',
      vnp_CurrCode: 'VND',
      vnp_TxnRef: orderId,
      vnp_OrderInfo: description || `Pay for order ${orderId}`,
      vnp_OrderType: 'other',
      vnp_Amount: amount,
      vnp_ReturnUrl: config.returnUrl?.trim() ?? '',
      vnp_IpAddr: ipAddress,
      vnp_CreateDate: createDate,
    };

    vnpParams['vnp_BankCode'] = 'VNPAY';

    return this.sortObject(vnpParams);
  }

  private generateSecureHash(
    params: Record<string, string | number | boolean>,
    secretKey: string,
  ): string {
    const signData = qs.stringify(params, { encode: false });
    const trimmedSecret = secretKey?.trim();
    return crypto
      .createHmac('sha512', trimmedSecret)
      .update(Buffer.from(signData, 'utf-8'))
      .digest('hex');
  }

  private sortObject(
    obj: Record<string, string | number | boolean>,
  ): Record<string, string> {
    const sorted: Record<string, string> = {};
    const str: string[] = [];
    let key: string;
    for (key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        str.push(encodeURIComponent(key));
      }
    }
    str.sort();
    for (let i = 0; i < str.length; i++) {
      const prop = str[i];
      const decodedKey = decodeURIComponent(prop);
      const rawValue = obj[decodedKey];
      sorted[prop] = encodeURIComponent(String(rawValue)).replace(/%20/g, '+');
    }
    return sorted;
  }

  // Format date as yyyyMMddHHmmss
  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    return `${year}${month}${day}${hours}${minutes}${seconds}`;
  }
}
