import { OmitType } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';
import { User } from '../entities/user.entity';

export class UserProfileResponseDto extends OmitType(User, [
  'bannedAt',
  'banReason',
  'role',
  'createdAt',
  'updatedAt',
]) {
  @Expose()
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

  @Expose()
  lastSolveAt: Date | null;
}
