import { PartialType } from '@nestjs/swagger';
import { CreatePromptConfigDto } from './create-prompt-config.dto';

export class UpdatePromptConfigDto extends PartialType(CreatePromptConfigDto) {}
