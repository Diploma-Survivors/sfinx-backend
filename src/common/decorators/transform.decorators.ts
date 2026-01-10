import { Transform } from 'class-transformer';

export function ToBoolean() {
  return Transform(({ value }) => {
    if (typeof value === 'boolean') {
      return value;
    }
    if (typeof value === 'string') {
      if (value.toLowerCase() === 'true') return true;
      if (value.toLowerCase() === 'false') return false;
    }
    return value;
  });
}
