import { ApiProperty, OmitType } from '@nestjs/swagger';

import { Exclude } from 'class-transformer';

import { Role } from 'src/modules/rbac/entities/role.entity';
import { User } from '../entities/user.entity';

export class UserResponseDto extends OmitType(User, [
  'isActive',
  'isBanned',
  'banReason',
  'bannedAt',
  'role',
]) {
  @Exclude()
  isActive: boolean;

  @Exclude()
  isBanned: boolean;

  @Exclude()
  banReason: string;

  @Exclude()
  bannedAt: Date;

  @Exclude()
  role: Role;
}

export class AuthResponseDto {
  @ApiProperty({
    description: 'JWT access token',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  accessToken: string;

  @ApiProperty({
    description: 'JWT refresh token',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  refreshToken: string;

  @ApiProperty({
    description: 'User information',
    type: () => UserResponseDto,
  })
  user: UserResponseDto;

  @ApiProperty({
    description: 'Token expiration time in seconds',
    example: 900,
  })
  expiresInSeconds: number;
}
