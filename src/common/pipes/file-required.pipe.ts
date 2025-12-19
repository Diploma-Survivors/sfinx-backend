import { BadRequestException, PipeTransform } from '@nestjs/common';

export class FileRequiredPipe implements PipeTransform {
  transform(value: Express.Multer.File) {
    if (!value) {
      throw new BadRequestException('File is required');
    }

    return value;
  }
}
