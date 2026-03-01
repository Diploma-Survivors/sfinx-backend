import { PartialType } from '@nestjs/swagger';
import { CreateDiscussionTagDto } from './create-tag.dto';

export class UpdateDiscussionTagDto extends PartialType(
  CreateDiscussionTagDto,
) {}
