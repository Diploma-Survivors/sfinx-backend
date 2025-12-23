import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash } from 'node:crypto';
import { Repository } from 'typeorm';
import { v4 as uuidV4 } from 'uuid';
import { PasswordResetToken } from '../entities/password-reset-token.entity';
import { User } from '../entities/user.entity';

@Injectable()
export class PasswordResetTokenService {
  private readonly logger = new Logger(PasswordResetTokenService.name);

  constructor(
    @InjectRepository(PasswordResetToken)
    private readonly tokenRepository: Repository<PasswordResetToken>,
  ) {}

  /**
   * Generate secure random token
   */
  generateToken(): string {
    return uuidV4().replace(/-/g, '');
  }

  /**
   * Hash token for storage
   */
  hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  /**
   * Create password reset token
   */
  async createToken(user: User, expiresInMs: number): Promise<string> {
    const token = this.generateToken();
    const hashedToken = this.hashToken(token);
    const expiresAt = new Date(Date.now() + expiresInMs);

    const resetToken = this.tokenRepository.create({
      user,
      token: hashedToken,
      expiresAt,
    });

    await this.tokenRepository.save(resetToken);
    this.logger.log(`Password reset token created for user ${user.email}`);

    return token; // Return plain token for email
  }

  /**
   * Find and validate token
   */
  async findAndValidateToken(token: string): Promise<PasswordResetToken> {
    const hashedToken = this.hashToken(token);

    const resetToken = await this.tokenRepository.findOne({
      where: { token: hashedToken },
      relations: ['user'],
    });

    if (!resetToken) {
      throw new Error('Invalid reset token');
    }

    if (resetToken.usedAt) {
      throw new Error('Reset token already used');
    }

    if (new Date() > resetToken.expiresAt) {
      throw new Error('Reset token has expired');
    }

    return resetToken;
  }

  /**
   * Mark token as used
   */
  async markAsUsed(resetToken: PasswordResetToken): Promise<void> {
    resetToken.usedAt = new Date();
    await this.tokenRepository.save(resetToken);
  }
}
