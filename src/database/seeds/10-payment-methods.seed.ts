import { DataSource } from 'typeorm';
import { PaymentMethod } from '../../modules/payments/entities/payment.method';
import { PaymentMethodTranslation } from '../../modules/payments/entities/payment-method-translation.entity';
import { PaymentMethodEnum } from '../../modules/payments/enums/payment-method.enum';

export const seedPaymentMethods = async (dataSource: DataSource) => {
  const methodRepo = dataSource.getRepository(PaymentMethod);
  const translationRepo = dataSource.getRepository(PaymentMethodTranslation);

  const methodsData = [
    {
      method: PaymentMethodEnum.VNPAY,
      iconUrl: null,
      isActive: true,
      translations: {
        en: {
          name: 'VNPay',
          description: 'Payment via VNPay gateway',
        },
        vi: {
          name: 'VNPay',
          description: 'Thanh toán qua cổng VNPay',
        },
      },
    },
  ];

  for (const data of methodsData) {
    let paymentMethod = await methodRepo.findOne({
      where: { method: data.method },
    });

    if (!paymentMethod) {
      paymentMethod = methodRepo.create({
        method: data.method,
        iconUrl: data.iconUrl ?? undefined,
        isActive: data.isActive,
      });
      await methodRepo.save(paymentMethod);
      console.log(`Created payment method: ${PaymentMethodEnum[data.method]}`);
    }

    for (const [lang, trans] of Object.entries(data.translations)) {
      let translation = await translationRepo.findOne({
        where: {
          paymentMethodId: paymentMethod.id,
          languageCode: lang,
        },
      });

      if (!translation) {
        translation = translationRepo.create({
          paymentMethodId: paymentMethod.id,
          languageCode: lang,
          name: trans.name,
          description: trans.description,
        });
      } else {
        translation.name = trans.name;
        translation.description = trans.description;
      }
      await translationRepo.save(translation);
    }
  }
};
