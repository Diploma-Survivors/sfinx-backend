import { SetMetadata } from '@nestjs/common';

export const SKIP_TRANSFORM_RESPONSE = Symbol('SKIP_TRANSFORM_RESPONSE');

export const SkipTransformResponse = () =>
  SetMetadata(SKIP_TRANSFORM_RESPONSE, true);
