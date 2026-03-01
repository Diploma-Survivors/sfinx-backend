import { PaymentTransaction } from '../entities/payment-transaction.entity';
import { PaymentMethodEnum } from '../enums/payment-method.enum';

export interface VerifyReturnUrlResult {
  isSuccess: boolean;
  transactionId?: string;
  message?: string;
  cardType?: string;
  bankCode?: string;
}

export interface PaymentProvider {
  /**
   * Returns the payment method this provider handles
   */
  getProviderName(): PaymentMethodEnum;

  /**
   * Generates the payment URL (e.g., redirect to payment gateway)
   * @param transaction The payment transaction entity
   * @param ipAddr The IP address of the client initiating the request
   * @returns The URL string
   */
  createPaymentUrl(
    transaction: PaymentTransaction,
    ipAddr: string,
  ): Promise<string>;

  /**
   * Verifies the return URL parameters from the provider
   * @param params Query parameters or body from the provider callback
   * @returns Validation result
   */
  verifyReturnUrl(params: any): Promise<VerifyReturnUrlResult>;
}
