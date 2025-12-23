import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash } from 'node:crypto';
import { Repository } from 'typeorm';
import { v4 as uuidV4 } from 'uuid';
import { EmailVerificationToken } from '../entities/email-verification-token.entity';
import { User } from '../entities/user.entity';

@Injectable()
export class EmailVerificationTokenService {
  private readonly logger = new Logger(EmailVerificationTokenService.name);

  constructor(
    @InjectRepository(EmailVerificationToken)
    private readonly tokenRepository: Repository<EmailVerificationToken>,
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
   * Create email verification token
   */
  async createToken(user: User, expiresInMs: number): Promise<string> {
    const token = this.generateToken();
    const hashedToken = this.hashToken(token);
    const expiresAt = new Date(Date.now() + expiresInMs);

    const verificationToken = this.tokenRepository.create({
      user,
      token: hashedToken,
      expiresAt,
    });

    await this.tokenRepository.save(verificationToken);
    this.logger.log(`Email verification token created for user ${user.email}`);

    return token; // Return plain token for email
  }

  /**
   * Find and validate token
   */
  async findAndValidateToken(token: string): Promise<EmailVerificationToken> {
    const hashedToken = this.hashToken(token);

    const verificationToken = await this.tokenRepository.findOne({
      where: { token: hashedToken },
      relations: ['user'],
    });

    if (!verificationToken) {
      throw new BadRequestException('Invalid verification token');
    }

    if (verificationToken.usedAt) {
      throw new BadRequestException('Verification token already used');
    }

    if (new Date() > verificationToken.expiresAt) {
      throw new BadRequestException('Verification token has expired');
    }

    return verificationToken;
  }

  /**
   * Mark token as used
   */
  async markAsUsed(verificationToken: EmailVerificationToken): Promise<void> {
    verificationToken.usedAt = new Date();
    await this.tokenRepository.save(verificationToken);
  }
}
