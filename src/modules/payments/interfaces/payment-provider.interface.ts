import { PaymentTransaction } from '../entities/payment-transaction.entity';

export interface VerifyReturnUrlResult {
  isSuccess: boolean;
  transactionId?: string;
  message?: string;
  cardType?: string;
  bankCode?: string;
}

export interface PaymentProvider {
  /**
   * Generates the payment URL (e.g., redirect to VNPAY)
   * @param transaction The payment transaction entity
   * @param ipAddr The IP address of the client initiating the request
   * @returns The URL string
   */
  createPaymentUrl(
    transaction: PaymentTransaction,
    ipAddr: string,
    bankCode?: string,
  ): Promise<string>;

  /**
   * Verifies the return URL parameters from the provider
   * @param params Query parameters or body from the provider callback
   * @returns Validation result
   */
  verifyReturnUrl(params: any): Promise<VerifyReturnUrlResult>;
}
