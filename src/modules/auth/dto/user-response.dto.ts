import { OmitType } from '@nestjs/swagger';
import { User } from '../entities/user.entity';
import { Exclude } from 'class-transformer';

export class UserResponseDto extends OmitType(User, [
  'isBanned',
  'bannedAt',
  'banReason',
  'role',
  'createdAt',
  'updatedAt',
]) {
  @Exclude()
  isBanned: boolean;

  @Exclude()
  bannedAt: Date;

  @Exclude()
  banReason: string;

  @Exclude()
  role: string;

  @Exclude()
  createdAt: Date;

  @Exclude()
  updatedAt: Date;
}
