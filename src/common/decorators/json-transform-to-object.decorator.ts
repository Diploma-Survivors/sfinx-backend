import { BadRequestException, Logger } from '@nestjs/common';
import { Transform } from 'class-transformer';

export function JsonTransformToObject(fieldName: string): PropertyDecorator {
  return Transform(({ value }) => {
    if (!value) {
      return;
    }

    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value) as unknown;
        return parsed;
      } catch (err) {
        if (err instanceof BadRequestException) {
          throw err;
        }
        Logger.warn(`Failed to parse ${fieldName}: ${err}`);
        throw new BadRequestException(`Invalid JSON format for ${fieldName}`);
      }
    }

    throw new BadRequestException(`${fieldName} must be a JSON string`);
  });
}
