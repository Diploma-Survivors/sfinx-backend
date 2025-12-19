import { PartialType } from '@nestjs/swagger';
import { CreateProgrammingLanguageDto } from './create-programming-language.dto';

export class UpdateProgrammingLanguageDto extends PartialType(
  CreateProgrammingLanguageDto,
) {}
