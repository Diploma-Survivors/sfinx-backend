import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { User } from './user.entity';

@Entity('refresh_tokens')
export class RefreshToken {
  @ApiProperty({ description: 'Unique identifier' })
  @PrimaryGeneratedColumn('increment')
  id: number;

  @ApiProperty({ description: 'User who owns this token', type: () => User })
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ApiProperty({ description: 'JWT ID (jti claim) for token identification' })
  @Column({ type: 'uuid', unique: true })
  jti: string;

  @ApiProperty({ description: 'Token expiration date' })
  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  @ApiProperty({ description: 'Whether token is revoked' })
  @Column({ name: 'is_revoked', default: false })
  isRevoked: boolean;

  @ApiProperty({ description: 'Revocation timestamp', required: false })
  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt: Date;

  @ApiProperty({
    description: 'IP address used for token creation',
    required: false,
  })
  @Column({ name: 'ip_address', type: 'inet', nullable: true })
  ipAddress: string;

  @ApiProperty({
    description: 'User agent used for token creation',
    required: false,
  })
  @Column({ name: 'user_agent', type: 'text', nullable: true })
  userAgent: string;

  @ApiProperty({ description: 'Creation timestamp' })
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
