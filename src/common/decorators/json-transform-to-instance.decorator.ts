import { BadRequestException, Logger } from '@nestjs/common';
import { plainToInstance, Transform } from 'class-transformer';

export function JsonTransformToInstance<T>(
  classContructor: new () => T,
): PropertyDecorator {
  return Transform(({ value }) => {
    if (typeof value === 'string') {
      try {
        const parsedValue = JSON.parse(value) as unknown;
        return plainToInstance(classContructor, parsedValue);
      } catch (err) {
        Logger.error(err);
        throw new BadRequestException(
          'Invalid JSON format for testcaseSamples',
        );
      }
    }

    throw new BadRequestException(
      'testcaseSamples must be a JSON array string',
    );
  });
}
