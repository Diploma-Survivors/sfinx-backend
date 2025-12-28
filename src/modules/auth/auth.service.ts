import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';

import { compare, hash } from 'bcrypt';
import { Repository } from 'typeorm';
import { v4 as uuidV4 } from 'uuid';

import { plainToInstance } from 'class-transformer';
import { AppConfig, JwtConfig } from 'src/config';
import { Transactional } from 'typeorm-transactional';
import {
  ALLOWED_AVATAR_EXTENSIONS,
  ALLOWED_AVATAR_MIME_TYPES,
  AVATAR_MAX_SIZE_BYTES,
  AVATAR_UPLOAD_URL_EXPIRES_IN,
} from './constants/avatar.constants';
import { MailService } from '../mail/mail.service';
import { Role } from '../rbac/entities/role.entity';
import { StorageService } from '../storage/storage.service';
import { AvatarUploadUrlResponseDto } from './dto/avatar-upload-url-response.dto';
import { AuthResponseDto, UserResponseDto } from './dto/auth-response.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { UpdateUserProfileDto } from './dto/update-user-profile.dto';
import { UserProfileResponseDto } from './dto/user-profile-response.dto';
import { RefreshToken } from './entities/refresh-token.entity';
import { User } from './entities/user.entity';
import { EmailVerificationTokenService } from './services/email-verification-token.service';
import { PasswordResetTokenService } from './services/password-reset-token.service';
import { JwtPayload } from './strategies/jwt.strategy';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly appConfig: AppConfig;
  private readonly jwtConfig: JwtConfig;

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepository: Repository<RefreshToken>,
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
    private readonly passwordResetTokenService: PasswordResetTokenService,
    private readonly emailVerificationTokenService: EmailVerificationTokenService,
    private readonly storageService: StorageService,
  ) {
    this.appConfig = this.configService.getOrThrow<AppConfig>('app');
    this.jwtConfig = this.configService.getOrThrow<JwtConfig>('jwt');
  }

  @Transactional()
  async register(registerDto: RegisterDto): Promise<AuthResponseDto> {
    const { email, username, password, fullName } = registerDto;

    // Check if email already exists
    const existingEmail = await this.userRepository.findOne({
      where: { email },
    });
    if (existingEmail) {
      throw new ConflictException('Email already exists');
    }

    // Check if username already exists
    const existingUsername = await this.userRepository.findOne({
      where: { username },
    });
    if (existingUsername) {
      throw new ConflictException('Username already exists');
    }

    const userRole = await this.roleRepository.findOne({
      where: { slug: 'user' },
    });

    if (!userRole) {
      throw new NotFoundException('User role not found');
    }

    // Hash password
    const saltRounds = this.appConfig.bcryptSaltRounds;
    const passwordHash = await hash(password, saltRounds);

    // Create user
    const user = this.userRepository.create({
      email,
      username,
      passwordHash,
      fullName,
      emailVerified: false,
      isActive: true,
      role: userRole,
    });

    const savedUser = await this.userRepository.save(user);

    // Send verification email
    await this.sendVerificationEmail(savedUser);

    // Generate tokens
    return this.generateAuthResponse(savedUser);
  }

  @Transactional()
  async login(
    loginDto: LoginDto,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<AuthResponseDto> {
    const { emailOrUsername, password } = loginDto;

    // Find user by email or username
    const user = await this.userRepository.findOne({
      where: [{ email: emailOrUsername }, { username: emailOrUsername }],
      relations: ['role', 'role.permissions'],
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if user is banned
    if (user.isBanned) {
      throw new UnauthorizedException(
        `Account is banned. Reason: ${user.banReason || 'No reason provided'}`,
      );
    }

    // Check if user is active
    if (!user.isActive) {
      throw new UnauthorizedException('Account is not active');
    }

    if (!user.passwordHash) {
      throw new UnauthorizedException('User has no password');
    }

    // Verify password
    const isPasswordValid = await compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Update last login
    user.lastLoginAt = new Date();
    user.lastActiveAt = new Date();
    await this.userRepository.save(user);

    // Generate tokens
    return this.generateAuthResponse(user, ipAddress, userAgent);
  }

  @Transactional()
  async refreshAccessToken(
    refreshToken: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<AuthResponseDto> {
    try {
      const publicKey = this.jwtConfig.publicKey;
      const algorithm = this.jwtConfig.algorithm;

      // Verify refresh token using RSA public key
      const payload = await this.jwtService.verifyAsync<JwtPayload>(
        refreshToken,
        {
          publicKey,
          algorithms: [algorithm],
        },
      );

      if (!payload?.jti) {
        throw new UnauthorizedException('Invalid token format');
      }

      // Find refresh token by jti in database
      const storedToken = await this.refreshTokenRepository.findOne({
        where: { jti: payload.jti },
        relations: ['user', 'user.role', 'user.role.permissions'],
      });

      if (!storedToken) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      if (storedToken.isRevoked) {
        throw new UnauthorizedException('Refresh token has been revoked');
      }

      if (new Date() > storedToken.expiresAt) {
        throw new UnauthorizedException('Refresh token has expired');
      }

      // Check if user is still active
      if (!storedToken.user.isActive || storedToken.user.isBanned) {
        throw new UnauthorizedException('User account is not active');
      }

      // Update last active
      storedToken.user.lastActiveAt = new Date();
      storedToken.isRevoked = true;
      storedToken.revokedAt = new Date();
      await this.refreshTokenRepository.save(storedToken);
      await this.userRepository.save(storedToken.user);

      // Generate new tokens
      return this.generateAuthResponse(storedToken.user, ipAddress, userAgent);
    } catch (error) {
      this.logger.warn(
        `Failed to validate refresh token: ${(error as Error).message}`,
      );
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  @Transactional()
  async logout(refreshToken: string): Promise<void> {
    // Decode token to extract jti
    const payload = await this.jwtService.verifyAsync<JwtPayload>(refreshToken);

    if (!payload?.jti) {
      return; // Invalid token format, nothing to revoke
    }

    const storedToken = await this.refreshTokenRepository.findOne({
      where: { jti: payload.jti },
    });

    if (!storedToken) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (storedToken.isRevoked) {
      throw new UnauthorizedException('Refresh token has been revoked');
    }

    storedToken.isRevoked = true;
    storedToken.revokedAt = new Date();
    await this.refreshTokenRepository.save(storedToken);
  }

  async validateUserById(userId: number): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['role', 'role.permissions'],
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (!user.isActive || user.isBanned) {
      throw new UnauthorizedException('User account is not active');
    }

    return user;
  }

  private async generateAuthResponse(
    user: User,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<AuthResponseDto> {
    const payload = {
      sub: user.id,
      email: user.email,
      username: user.username,
      role: user.role?.slug,
    };

    const accessExpiresInMs = this.jwtConfig.accessExpiresInMs;
    const refreshExpiresInMs = this.jwtConfig.refreshExpiresInMs;

    const accessToken = await this.jwtService.signAsync(payload, {
      expiresIn: `${accessExpiresInMs}ms`,
    } as JwtSignOptions);

    // Generate unique jti for refresh token
    const jti = uuidV4();

    const refreshTokenValue = await this.jwtService.signAsync(payload, {
      expiresIn: `${refreshExpiresInMs}ms`,
      jwtid: jti,
    } as JwtSignOptions);

    const expiresAt = new Date(Date.now() + refreshExpiresInMs);

    // Store only jti (not full token)
    const refreshToken = this.refreshTokenRepository.create({
      user,
      jti,
      expiresAt,
      ipAddress,
      userAgent,
    });
    await this.refreshTokenRepository.save(refreshToken);

    return {
      accessToken,
      refreshToken: refreshTokenValue,
      user: plainToInstance(UserResponseDto, user),
      expiresInSeconds: Math.floor(accessExpiresInMs / 1000),
    };
  }

  // ==================== EMAIL VERIFICATION ====================

  /**
   * Send email verification token
   */
  @Transactional()
  async sendVerificationEmail(user: User): Promise<void> {
    // Create verification token (24 hours)
    const token = await this.emailVerificationTokenService.createToken(
      user,
      24 * 60 * 60 * 1000,
    );

    // Send verification email
    const verificationUrl = `${this.appConfig.frontendUrl}/verify-email?token=${token}`;
    await this.mailService.sendVerificationEmail(
      user.email,
      user.fullName || user.username,
      verificationUrl,
    );
  }

  /**
   * Verify email with token
   */
  @Transactional()
  async verifyEmail(token: string): Promise<{ message: string }> {
    try {
      const verificationToken =
        await this.emailVerificationTokenService.findAndValidateToken(token);

      // Mark email as verified
      verificationToken.user.emailVerified = true;
      await this.userRepository.save(verificationToken.user);

      // Mark token as used
      await this.emailVerificationTokenService.markAsUsed(verificationToken);

      this.logger.log(
        `Email verified for user ${verificationToken.user.email}`,
      );

      return { message: 'Email verified successfully' };
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('Invalid')) {
          throw new NotFoundException(error.message);
        }
        throw new ConflictException(error.message);
      }
      throw error;
    }
  }

  /**
   * Resend verification email
   */
  @Transactional()
  async resendVerificationEmail(email: string): Promise<{ message: string }> {
    const user = await this.userRepository.findOne({ where: { email } });

    if (!user) {
      // Don't reveal if email exists
      return {
        message: 'If the email exists, a verification link has been sent',
      };
    }

    if (user.emailVerified) {
      throw new ConflictException('Email is already verified');
    }

    await this.sendVerificationEmail(user);

    return { message: 'Verification email sent' };
  }

  // ==================== PASSWORD RESET ====================

  /**
   * Request password reset
   */
  @Transactional()
  async forgotPassword(email: string): Promise<{ message: string }> {
    const user = await this.userRepository.findOne({ where: { email } });

    if (!user) {
      // Don't reveal if email exists (security best practice)
      return {
        message: 'If the email exists, a password reset link has been sent',
      };
    }

    // Create reset token (1 hour)
    const token = await this.passwordResetTokenService.createToken(
      user,
      60 * 60 * 1000,
    );

    // Send reset email
    const resetUrl = `${this.appConfig.frontendUrl}/reset-password?token=${token}`;
    await this.mailService.sendPasswordResetEmail(
      user.email,
      user.fullName || user.username,
      resetUrl,
    );

    return { message: 'Password reset email sent' };
  }

  /**
   * Reset password with token
   */
  @Transactional()
  async resetPassword(
    token: string,
    newPassword: string,
  ): Promise<{ message: string }> {
    try {
      const resetToken =
        await this.passwordResetTokenService.findAndValidateToken(token);

      // Hash new password
      const saltRounds = this.appConfig.bcryptSaltRounds;
      const passwordHash = await hash(newPassword, saltRounds);

      // Update password
      resetToken.user.passwordHash = passwordHash;
      await this.userRepository.save(resetToken.user);

      // Mark token as used
      await this.passwordResetTokenService.markAsUsed(resetToken);

      // Send confirmation email
      await this.mailService.sendPasswordChangedEmail(
        resetToken.user.email,
        resetToken.user.fullName || resetToken.user.username,
      );

      this.logger.log(`Password reset for user ${resetToken.user.email}`);

      return { message: 'Password reset successfully' };
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('Invalid')) {
          throw new NotFoundException(error.message);
        }
        throw new ConflictException(error.message);
      }
      throw error;
    }
  }

  /**
   * Change password (authenticated user)
   */
  @Transactional()
  async changePassword(
    userId: number,
    currentPassword: string,
    newPassword: string,
  ): Promise<{ message: string }> {
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!user.passwordHash) {
      throw new UnauthorizedException('User has no password set');
    }

    // Verify current password
    const isPasswordValid = await compare(currentPassword, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    // Hash new password
    const saltRounds = this.appConfig.bcryptSaltRounds;
    const passwordHash = await hash(newPassword, saltRounds);

    // Update password
    user.passwordHash = passwordHash;
    await this.userRepository.save(user);

    // Send confirmation email
    await this.mailService.sendPasswordChangedEmail(
      user.email,
      user.fullName || user.username,
    );

    this.logger.log(`Password changed for user ${user.email}`);

    return { message: 'Password changed successfully' };
  }

  /**
   * Update user profile
   */
  @Transactional()
  async updateUserProfile(
    userId: number,
    dto: UpdateUserProfileDto,
  ): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    // Update only provided fields
    Object.assign(user, dto);

    return this.userRepository.save(user);
  }

  // ==================== AVATAR UPLOAD ====================

  /**
   * Generate presigned URL for avatar upload
   */
  async generateAvatarUploadUrl(
    userId: number,
    fileName: string,
    contentType: string,
  ): Promise<AvatarUploadUrlResponseDto> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    if (!ALLOWED_AVATAR_MIME_TYPES.includes(contentType as any)) {
      throw new BadRequestException(
        `Invalid content type. Allowed: ${ALLOWED_AVATAR_MIME_TYPES.join(', ')}`,
      );
    }

    const fileExtension = fileName.split('.').pop()?.toLowerCase();
    if (
      !fileExtension ||
      !ALLOWED_AVATAR_EXTENSIONS.includes(fileExtension as any)
    ) {
      throw new BadRequestException(
        `Invalid file extension. Allowed: ${ALLOWED_AVATAR_EXTENSIONS.join(', ')}`,
      );
    }

    const timestamp = Date.now();
    const key = `avatars/${userId}/${timestamp}.${fileExtension}`;

    const uploadUrl = await this.storageService.getPresignedUploadUrl(
      key,
      AVATAR_UPLOAD_URL_EXPIRES_IN,
      contentType,
      AVATAR_MAX_SIZE_BYTES,
    );

    this.logger.log(`Generated avatar upload URL for user ${userId}: ${key}`);

    return {
      uploadUrl,
      key,
      expiresIn: AVATAR_UPLOAD_URL_EXPIRES_IN,
      maxSizeBytes: AVATAR_MAX_SIZE_BYTES,
    };
  }

  /**
   * Confirm avatar upload and save S3 key to database
   */
  @Transactional()
  async confirmAvatarUpload(userId: number, key: string): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    const keyPattern = new RegExp(
      `^avatars/${userId}/\\d+\\.(jpg|jpeg|png|webp|gif)$`,
      'i',
    );
    if (!keyPattern.test(key)) {
      throw new BadRequestException(
        `Invalid S3 key format. Expected: avatars/${userId}/{timestamp}.{ext}`,
      );
    }

    const fileExists = await this.storageService.fileExists(key);
    if (!fileExists) {
      throw new NotFoundException(
        'Upload not found in S3. Please upload the file first using the presigned URL.',
      );
    }

    await this.cleanupOldAvatars(userId, key);

    user.avatarKey = key;
    const savedUser = await this.userRepository.save(user);

    this.logger.log(`Avatar key saved for user ${userId}: ${key}`);

    return savedUser;
  }

  /**
   * Delete user avatar
   */
  @Transactional()
  async deleteAvatar(userId: number): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    if (!user.avatarKey) {
      throw new BadRequestException('User has no avatar to delete');
    }

    if (this.isS3Key(user.avatarKey)) {
      try {
        await this.storageService.deleteFile(user.avatarKey);
        this.logger.log(`Deleted avatar from S3: ${user.avatarKey}`);
      } catch (error) {
        this.logger.warn(
          `Failed to delete avatar from S3: ${(error as Error).message}`,
        );
      }
    }

    user.avatarKey = null;
    const savedUser = await this.userRepository.save(user);

    this.logger.log(`Avatar deleted for user ${userId}`);

    return savedUser;
  }

  /**
   * Clean up old avatars for a user
   */
  private async cleanupOldAvatars(
    userId: number,
    currentKey: string,
  ): Promise<void> {
    try {
      const prefix = `avatars/${userId}/`;
      const keys = await this.storageService.listObjectsByPrefix(prefix);

      const keysToDelete = keys.filter((key) => key !== currentKey);

      if (keysToDelete.length > 0) {
        this.logger.log(
          `Cleaning up ${keysToDelete.length} old avatar(s) for user ${userId}`,
        );

        await Promise.allSettled(
          keysToDelete.map((key) => this.storageService.deleteFile(key)),
        );
      }
    } catch (error) {
      this.logger.warn(
        `Failed to cleanup old avatars for user ${userId}: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Transform User entity to UserProfileResponseDto with CloudFront URLs
   */
  transformUserResponse(user: User): UserProfileResponseDto {
    const dto = plainToInstance(UserProfileResponseDto, user);

    if (dto.avatarKey && this.isS3Key(dto.avatarKey)) {
      (dto as any).avatarUrl = this.storageService.getCloudFrontUrl(
        dto.avatarKey,
      );
    }

    return dto;
  }

  /**
   * Check if a string is an S3 key (not a full URL)
   */
  private isS3Key(value: string): boolean {
    if (!value) return false;
    return !value.startsWith('http://') && !value.startsWith('https://');
  }

  @Cron('0 2 * * *') // Run daily at 2:00 AM
  async cleanupExpiredTokens(): Promise<void> {
    const result = await this.refreshTokenRepository
      .createQueryBuilder()
      .delete()
      .where('expires_at < :now OR is_revoked = true', { now: new Date() })
      .execute();

    this.logger.log(
      `Cleanup completed. Removed ${result.affected || 0} expired/revoked tokens.`,
    );
  }
}
