import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { hash } from 'bcrypt';
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
    return uuidV4() + uuidV4().replace(/-/g, '');
  }

  /**
   * Hash token for storage
   */
  async hashToken(token: string): Promise<string> {
    return hash(token, 10);
  }

  /**
   * Create email verification token
   */
  async createToken(user: User, expiresInMs: number): Promise<string> {
    const token = this.generateToken();
    const hashedToken = await this.hashToken(token);
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
    const hashedToken = await this.hashToken(token);

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
