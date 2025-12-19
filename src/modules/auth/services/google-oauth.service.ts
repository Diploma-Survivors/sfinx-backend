import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import axios from 'axios';
import { Repository } from 'typeorm';
import { Transactional } from 'typeorm-transactional';
import { GoogleConfig } from '../../../config/google.config';
import { Role } from '../../rbac/entities/role.entity';
import { AuthService } from '../auth.service';
import { AuthResponseDto } from '../dto/auth-response.dto';
import { GoogleTokenResponse, GoogleUserInfo } from '../dto/google-auth.dto';
import { User } from '../entities/user.entity';

@Injectable()
export class GoogleOAuthService {
  private readonly logger = new Logger(GoogleOAuthService.name);
  private readonly googleConfig: GoogleConfig;

  // Google OAuth endpoints
  private readonly GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
  private readonly GOOGLE_USERINFO_URL =
    'https://www.googleapis.com/oauth2/v2/userinfo';
  private readonly GOOGLE_AUTH_URL =
    'https://accounts.google.com/o/oauth2/v2/auth';

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
    private readonly configService: ConfigService,
    private readonly authService: AuthService,
  ) {
    this.googleConfig = this.configService.getOrThrow<GoogleConfig>('google');
  }

  /**
   * Generate Google OAuth URL for user to authorize
   */
  getAuthorizationUrl(): string {
    const params = new URLSearchParams({
      client_id: this.googleConfig.clientId,
      redirect_uri: this.googleConfig.callbackUrl,
      response_type: 'code',
      scope: [
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/userinfo.profile',
      ].join(' '),
      access_type: 'offline', // Request refresh token
      prompt: 'consent', // Force consent screen to get refresh token
    });

    return `${this.GOOGLE_AUTH_URL}?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token and refresh token
   */
  private async exchangeCodeForTokens(
    code: string,
  ): Promise<GoogleTokenResponse> {
    try {
      const response = await axios.post<GoogleTokenResponse>(
        this.GOOGLE_TOKEN_URL,
        {
          code,
          client_id: this.googleConfig.clientId,
          client_secret: this.googleConfig.clientSecret,
          redirect_uri: this.googleConfig.callbackUrl,
          grant_type: 'authorization_code',
        },
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        },
      );

      this.logger.log('Successfully exchanged code for tokens');
      return response.data;
    } catch (error) {
      this.logger.error('Failed to exchange code for tokens', error);
      throw new UnauthorizedException('Failed to authenticate with Google');
    }
  }

  /**
   * Get user info from Google using access token
   */
  private async getUserInfo(accessToken: string): Promise<GoogleUserInfo> {
    try {
      const response = await axios.get<GoogleUserInfo>(
        this.GOOGLE_USERINFO_URL,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );

      this.logger.log(`Retrieved user info for Google ID: ${response.data.id}`);
      return response.data;
    } catch (error) {
      this.logger.error('Failed to get user info from Google', error);
      throw new UnauthorizedException('Failed to get user information');
    }
  }

  /**
   * Handle Google OAuth callback - full flow
   */
  @Transactional()
  async handleGoogleCallback(
    code: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<AuthResponseDto> {
    // Step 1: Exchange code for tokens
    const tokenResponse = await this.exchangeCodeForTokens(code);

    // Step 2: Get user info from Google
    const googleUser = await this.getUserInfo(tokenResponse.access_token);

    // Step 3: Find or create user
    let user = await this.userRepository.findOne({
      where: { googleId: googleUser.id },
      relations: ['role', 'role.permissions'],
    });

    if (!user) {
      // Check if email already exists with different auth method
      const existingUser = await this.userRepository.findOne({
        where: { email: googleUser.email },
      });

      if (existingUser && !existingUser.googleId) {
        // Link Google account to existing email
        existingUser.googleId = googleUser.id;
        existingUser.emailVerified = googleUser.verified_email;
        existingUser.avatarUrl ??= googleUser.picture;
        user = await this.userRepository.save(existingUser);
        this.logger.log(
          `Linked Google account to existing user: ${user.email}`,
        );
      } else if (existingUser && existingUser.googleId) {
        throw new ConflictException(
          'This Google account is already linked to another user',
        );
      } else {
        // Create new user
        user = await this.createGoogleUser(googleUser);
        this.logger.log(`Created new user from Google: ${user.email}`);
      }
    }

    // Check if user is banned or inactive
    if (user.isBanned) {
      throw new UnauthorizedException(
        `Account is banned. Reason: ${user.banReason || 'No reason provided'}`,
      );
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account is not active');
    }

    // Update last login
    user.lastLoginAt = new Date();
    user.lastActiveAt = new Date();
    await this.userRepository.save(user);

    // Generate application tokens (using auth service)
    return this.authService['generateAuthResponse'](user, ipAddress, userAgent);
  }

  /**
   * Create a new user from Google account
   */
  private async createGoogleUser(googleUser: GoogleUserInfo): Promise<User> {
    // Generate unique username from email
    const baseUsername = googleUser.email.split('@')[0];
    let username = baseUsername;
    let counter = 1;

    // Ensure username is unique

    while (true) {
      const existing = await this.userRepository.findOne({
        where: { username },
      });
      if (!existing) break;
      username = `${baseUsername}${counter}`;
      counter++;
    }

    // Get user role
    const userRole = await this.roleRepository.findOne({
      where: { slug: 'user' },
    });

    if (!userRole) {
      throw new NotFoundException('User role not found');
    }

    // Create user
    const user = this.userRepository.create({
      email: googleUser.email,
      username,
      googleId: googleUser.id,
      fullName: googleUser.name,
      avatarUrl: googleUser.picture,
      emailVerified: googleUser.verified_email,
      isActive: true,
      passwordHash: null, // No password for OAuth users
      role: userRole,
    });

    return this.userRepository.save(user);
  }

  /**
   * Refresh Google access token using refresh token
   * Note: This refreshes the GOOGLE access token, not application's token
   */
  async refreshGoogleAccessToken(refreshToken: string): Promise<string> {
    try {
      const response = await axios.post<{
        access_token: string;
        expires_in: number;
        token_type: string;
      }>(
        this.GOOGLE_TOKEN_URL,
        {
          client_id: this.googleConfig.clientId,
          client_secret: this.googleConfig.clientSecret,
          refresh_token: refreshToken,
          grant_type: 'refresh_token',
        },
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        },
      );

      return response.data.access_token;
    } catch (error) {
      this.logger.error('Failed to refresh Google access token', error);
      throw new UnauthorizedException('Failed to refresh Google access token');
    }
  }
}
