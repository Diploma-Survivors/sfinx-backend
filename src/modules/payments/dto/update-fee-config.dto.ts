import { PartialType } from '@nestjs/swagger';
import { CreateFeeConfigDto } from './create-fee-config.dto';

export class UpdateFeeConfigDto extends PartialType(CreateFeeConfigDto) {}
