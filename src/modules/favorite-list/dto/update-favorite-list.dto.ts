import { PartialType } from '@nestjs/swagger';
import { CreateFavoriteListDto } from './create-favorite-list.dto';

export class UpdateFavoriteListDto extends PartialType(CreateFavoriteListDto) {}
