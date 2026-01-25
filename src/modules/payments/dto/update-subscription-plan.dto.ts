import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { CreateSubscriptionPlanDto } from './create-subscription-plan.dto';
import { IsOptional } from 'class-validator';
import { TranslationDto } from './translation.dto';

export class UpdateSubscriptionPlanDto extends PartialType(
  CreateSubscriptionPlanDto,
) {
  @ApiPropertyOptional({
    description:
      'Translations to update or add. Existing translations for language codes not in this list will be preserved',
    type: [Object], // Swagger UI hint
    example: [
      {
        languageCode: 'en',
        name: 'Updated Monthly Plan',
        description: 'Updated description',
      },
    ],
  })
  @IsOptional()
  translations?: TranslationDto[]; // Inherits type validation from Parent
}
