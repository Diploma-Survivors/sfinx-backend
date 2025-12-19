import {
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
import { Role } from '../rbac/entities/role.entity';
import { AuthResponseDto, UserResponseDto } from './dto/auth-response.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { RefreshToken } from './entities/refresh-token.entity';
import { User } from './entities/user.entity';
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
