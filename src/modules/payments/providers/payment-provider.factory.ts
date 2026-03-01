import { BadRequestException, Injectable, OnModuleInit } from '@nestjs/common';
import { PaymentMethodEnum } from '../enums/payment-method.enum';
import type { PaymentProvider } from '../interfaces/payment-provider.interface';
import { VnPayProvider } from './vnpay.provider';

@Injectable()
export class PaymentProviderFactory implements OnModuleInit {
  private readonly providers = new Map<PaymentMethodEnum, PaymentProvider>();

  constructor(private readonly vnPayProvider: VnPayProvider) {}

  onModuleInit(): void {
    this.registerProvider(this.vnPayProvider);
  }

  private registerProvider(provider: PaymentProvider): void {
    this.providers.set(provider.getProviderName(), provider);
  }

  getProvider(method: PaymentMethodEnum): PaymentProvider {
    const provider = this.providers.get(method);
    if (!provider) {
      throw new BadRequestException(
        `Payment method "${PaymentMethodEnum[method]}" is not supported`,
      );
    }
    return provider;
  }

  getSupportedMethods(): PaymentMethodEnum[] {
    return Array.from(this.providers.keys());
  }
}
