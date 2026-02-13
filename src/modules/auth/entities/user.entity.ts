import { ApiProperty } from '@nestjs/swagger';
import { Exclude } from 'class-transformer';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Role } from '../../rbac/entities/role.entity';
import { UserStatistics } from '../../submissions/entities/user-statistics.entity';
import { Language } from '../enums';

@Entity('users')
export class User {
  @ApiProperty({ description: 'Unique identifier', example: 1 })
  @PrimaryGeneratedColumn('increment')
  id: number;

  @ApiProperty({
    description: 'User email address',
    example: 'user@example.com',
  })
  @Column({ unique: true, length: 255 })
  email: string;

  @ApiProperty({ description: 'Unique username', example: 'username' })
  @Column({ unique: true, length: 50 })
  username: string;

  @Exclude()
  @Column({
    name: 'password_hash',
    type: 'varchar',
    nullable: true,
    length: 255,
  })
  passwordHash: string | null;

  // Profile information
  @ApiProperty({
    description: 'Full name',
    required: false,
    example: 'John Doe',
  })
  @Column({ name: 'full_name', nullable: true, length: 100 })
  fullName: string;

  @ApiProperty({
    description: 'Avatar URL (CloudFront CDN)',
    required: false,
    example: 'https://cdn.example.com/avatars/123/1735500000.jpg',
    name: 'avatarUrl',
  })
  @Column({ name: 'avatar_key', type: 'text', nullable: true })
  avatarKey: string | null;

  @ApiProperty({
    description: 'User bio',
    required: false,
    example: 'This is a bio',
  })
  @Column({ type: 'text', nullable: true })
  bio: string;

  @ApiProperty({
    description: 'User address',
    required: false,
    example: '123 Street, City',
  })
  @Column({ nullable: true, length: 255 })
  address: string;

  @ApiProperty({
    description: 'Phone number',
    required: false,
    example: '0901234567',
  })
  @Column({ nullable: true, length: 20 })
  phone: string;

  @ApiProperty({
    description: 'User statistics',
    type: () => UserStatistics,
  })
  @OneToOne(() => UserStatistics, (stats) => stats.user, {
    cascade: false, // We handle creation manually or via signals
    eager: true, // Always load stats with user
  })
  statistics: UserStatistics;

  @ApiProperty({
    description: 'Website URL',
    required: false,
    example: 'https://example.com',
  })
  @Column({ name: 'website_url', nullable: true, length: 255 })
  websiteUrl: string;

  @ApiProperty({
    description: 'GitHub username',
    required: false,
    example: 'github-username',
  })
  @Column({ name: 'github_username', nullable: true, length: 100 })
  githubUsername: string;

  @ApiProperty({
    description: 'LinkedIn URL',
    required: false,
    example: 'https://linkedin.com/in/username',
  })
  @Column({ name: 'linkedin_url', nullable: true, length: 255 })
  linkedinUrl: string;

  @ApiProperty({
    description: 'Preferred language for UI',
    enum: Language,
    example: Language.EN,
  })
  @Column({
    name: 'preferred_language',
    type: 'varchar',
    length: 2,
    default: Language.EN,
    comment: 'User preferred language for i18n (en, vi)',
  })
  preferredLanguage: Language;

  // OAuth integration
  @ApiProperty({
    description: 'Google ID',
    required: false,
    example: '1234567890',
  })
  @Column({ name: 'google_id', unique: true, nullable: true, length: 255 })
  googleId: string;

  // Status and verification
  @ApiProperty({ description: 'Email verification status', example: true })
  @Column({ name: 'email_verified', default: false })
  emailVerified: boolean;

  @ApiProperty({ description: 'Account active status', example: true })
  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @ApiProperty({ description: 'Account banned status', example: false })
  @Column({ name: 'is_banned', default: false })
  isBanned: boolean;

  @ApiProperty({ description: 'Ban reason', required: false, example: 'Spam' })
  @Column({ name: 'ban_reason', type: 'text', nullable: true })
  banReason: string;

  @ApiProperty({
    description: 'Ban timestamp',
    required: false,
    example: '2025-12-19T11:22:11.000Z',
  })
  @Column({ name: 'banned_at', type: 'timestamptz', nullable: true })
  bannedAt: Date | null;

  // Premium subscription
  @ApiProperty({ description: 'Premium subscription status', example: false })
  @Column({ name: 'is_premium', default: false })
  isPremium: boolean;

  @ApiProperty({
    description: 'Premium subscription start date',
    required: false,
    example: '2025-12-19T11:22:11.000Z',
  })
  @Column({ name: 'premium_started_at', type: 'timestamptz', nullable: true })
  premiumStartedAt: Date | null;

  @ApiProperty({
    description: 'Premium subscription expiry date',
    required: false,
    example: '2025-12-19T11:22:11.000Z',
  })
  @Column({ name: 'premium_expires_at', type: 'timestamptz', nullable: true })
  premiumExpiresAt: Date | null;

  // Metadata
  @ApiProperty({
    description: 'Last login timestamp',
    required: false,
    example: '2025-12-19T11:22:11.000Z',
  })
  @Column({ name: 'last_login_at', type: 'timestamptz', nullable: true })
  lastLoginAt: Date;

  @ApiProperty({
    description: 'Last activity timestamp',
    required: false,
    example: '2025-12-19T11:22:11.000Z',
  })
  @Column({ name: 'last_active_at', type: 'timestamptz', nullable: true })
  lastActiveAt: Date;

  // Role relationship
  @ApiProperty({ description: 'User role', type: () => Role, required: false })
  @ManyToOne(() => Role, { nullable: true, eager: true })
  @JoinColumn({ name: 'role_id' })
  role: Role;

  @ApiProperty({
    description: 'Creation timestamp',
    example: '2025-12-19T11:22:11.000Z',
  })
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @ApiProperty({
    description: 'Last update timestamp',
    example: '2025-12-19T11:22:11.000Z',
  })
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
