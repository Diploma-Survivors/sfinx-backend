import type { Response } from 'express';

import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Ip,
  Optional,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { GetUser } from '../../common';
import { AppConfig } from '../../config';
import { AuthService } from './auth.service';
import { AuthResponseDto } from './dto/auth-response.dto';
import { AvatarUploadUrlResponseDto } from './dto/avatar-upload-url-response.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ConfirmAvatarUploadDto } from './dto/confirm-avatar-upload.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { GoogleAuthDto } from './dto/google-auth.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { RequestAvatarUploadUrlDto } from './dto/request-avatar-upload-url.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UpdateUserProfileDto } from './dto/update-user-profile.dto';
import { UserProfileResponseDto } from './dto/user-profile-response.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { User } from './entities/user.entity';
import { GoogleAuthGuard } from './guards/google-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { GoogleOAuthService } from './services/google-oauth.service';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly googleOAuthService: GoogleOAuthService,
    private readonly configService: ConfigService,
  ) {}

  private generateOAuthRedirectHtml(authResponse: AuthResponseDto): string {
    const appConfig = this.configService.get<AppConfig>('app');
    const frontendUrl = appConfig?.frontendUrl || 'http://localhost:3001';
    const handshakeUrl = `${frontendUrl}/api/proxy/signin`;

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Redirecting...</title>
    <style>
        /* SfinX Color System Extracted from globals.css */
        :root {
            --background: oklch(1 0 0);
            --foreground: oklch(0.145 0 0);
            --primary: oklch(0.54 0.17 142);
            --primary-foreground: oklch(1 0 0);
            --muted-foreground: oklch(0.556 0 0);
        }

        @media (prefers-color-scheme: dark) {
            :root {
                --background: oklch(0.145 0 0);
                --foreground: oklch(0.985 0 0);
                --primary: oklch(0.623 0.188 145.42);
                --primary-foreground: oklch(0.145 0 0);
                --muted-foreground: oklch(0.708 0 0);
            }
        }

        body {
            font-family: 'Geist Sans', Arial, sans-serif;
            margin: 0;
            background-color: var(--background);
            color: var(--foreground);
            height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            overflow: hidden;
        }

        /* Overlay mimicking bg-background/50 and backdrop-blur-sm */
        .loader-container {
            position: fixed;
            inset: 0;
            z-index: 100;
            display: flex;
            align-items: center;
            justify-content: center;
            background-color: color-mix(in srgb, var(--background) 50%, transparent);
            backdrop-filter: blur(4px);
            -webkit-backdrop-filter: blur(4px);
        }

        .loader-wrapper {
            position: relative;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            text-align: center;
            gap: 2.5rem;
            padding: 24px;
            max-width: 90%;
            width: 450px;
        }

        /* Wrapper that mimics animate-pulse */
        .brand-animation {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }

        /* SfinX typography mimicking text-6xl font-bold tracking-tight text-primary */
        .brand-text {
            font-size: 3.75rem; 
            line-height: 1;
            font-weight: 700; 
            letter-spacing: -0.025em; 
            color: var(--primary); 
        }

        @keyframes pulse {
            0%, 100% {
                opacity: 1;
            }
            50% {
                opacity: .5;
            }
        }

        /* Information Text Styles */
        .text-info {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 0.75rem;
        }

        h2 {
            font-size: 1.25rem;
            font-weight: 600;
            margin: 0;
            color: var(--foreground);
            letter-spacing: -0.025em;
        }

        p {
            font-size: 0.95rem;
            margin: 0;
            color: var(--muted-foreground);
        }

        small {
            font-size: 0.85rem;
            color: var(--muted-foreground);
            opacity: 0.8;
            margin-top: 0.25rem;
        }

        /* Submit Button using actual SfinX Primary Colors */
        .btn {
            margin-top: 1.5rem;
            padding: 0.625rem 1.25rem;
            background-color: var(--primary);
            color: var(--primary-foreground);
            border: none;
            border-radius: 0.5rem;
            font-size: 0.875rem;
            font-weight: 500;
            cursor: pointer;
            transition: opacity 0.2s ease;
        }

        .btn:hover {
            opacity: 0.9;
        }

        #postRedirectForm {
            margin: 0;
            display: flex;
            justify-content: center;
        }
    </style>
</head>
<body>
    <div class="loader-container">
        <div class="loader-wrapper">
            <!-- Pulsing Global Loader mimicking your frontend -->
            <div class="brand-animation">
                <span class="brand-text">SfinX</span>
            </div>
            
            <!-- Information text and manual form sumbit -->
            <div class="text-info">
                <h2>Redirecting...</h2>
                <p>Please wait while we process your authentication...</p>
                <p><small>If you are not redirected automatically, please click the button below.</small></p>

                <form id="postRedirectForm" action="${handshakeUrl}" method="POST">
                    <input type="hidden" name="accessToken" value="${authResponse.accessToken}" />
                    <input type="hidden" name="refreshToken" value="${authResponse.refreshToken}" />
                    <input type="hidden" name="userId" value="${authResponse.user.id}" />
                    <input type="hidden" name="expiresIn" value="${authResponse.expiresInSeconds}" />
                    <button type="submit" class="btn">
                        Continue
                    </button>
                </form>
            </div>
        </div>
    </div>

    <script type="text/javascript">
        (function() {
            var form = document.getElementById('postRedirectForm');
            if (form) {
                form.submit();
            }
        })();
    </script>
</body>
</html>
    `;
  }

  @Throttle({
    default: {
      limit: 3,
      ttl: 60000,
    },
  })
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({
    status: 201,
    description: 'User successfully registered',
    type: AuthResponseDto,
  })
  @ApiResponse({
    status: 409,
    description: 'Email or username already exists',
  })
  @ApiResponse({
    status: 400,
    description: 'Validation error',
  })
  async register(@Body() registerDto: RegisterDto): Promise<AuthResponseDto> {
    return this.authService.register(registerDto);
  }

  @Throttle({
    default: {
      limit: 3,
      ttl: 60000,
    },
  })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login user' })
  @ApiHeader({
    name: 'user-agent',
    required: false,
    description: 'User agent string (automatically sent by browser/client)',
  })
  @ApiResponse({
    status: 200,
    description: 'User successfully logged in',
    type: AuthResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid credentials',
  })
  async login(
    @Body() loginDto: LoginDto,
    @Ip() ipAddress: string,
    @Headers('user-agent') @Optional() userAgent?: string,
  ): Promise<AuthResponseDto> {
    return this.authService.login(loginDto, ipAddress, userAgent);
  }

  @Throttle({
    default: {
      limit: 5,
      ttl: 60000,
    },
  })
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiHeader({
    name: 'user-agent',
    required: false,
    description: 'User agent string (automatically sent by browser/client)',
  })
  @ApiResponse({
    status: 200,
    description: 'Token successfully refreshed',
    type: AuthResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid or expired refresh token',
  })
  async refreshToken(
    @Body() refreshTokenDto: RefreshTokenDto,
    @Ip() ipAddress: string,
    @Headers('user-agent') @Optional() userAgent?: string,
  ): Promise<AuthResponseDto> {
    return this.authService.refreshAccessToken(
      refreshTokenDto.refreshToken,
      ipAddress,
      userAgent,
    );
  }

  @Throttle({
    default: {
      limit: 2,
      ttl: 60000,
    },
  })
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout user' })
  @ApiResponse({
    status: 200,
    description: 'User successfully logged out',
  })
  async logout(@Body() refreshTokenDto: RefreshTokenDto): Promise<void> {
    await this.authService.logout(refreshTokenDto.refreshToken);
  }

  @Throttle({
    default: {
      limit: 10,
      ttl: 60000,
    },
  })
  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiBearerAuth('JWT-auth')
  @ApiResponse({
    status: 200,
    description: 'Current user profile',
    type: UserProfileResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  async getCurrentUser(@GetUser() user: User): Promise<UserProfileResponseDto> {
    const fetchUser = await this.authService.getUserProfile(user.id);
    return this.authService.transformUserResponse(fetchUser);
  }

  @Throttle({
    default: {
      limit: 5,
      ttl: 60000,
    },
  })
  @Patch('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Update user profile',
    description:
      'Update authenticated user profile information including language preference',
  })
  @ApiResponse({
    status: 200,
    description: 'Profile updated successfully',
    type: UserProfileResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async updateProfile(
    @GetUser('id') userId: number,
    @Body() dto: UpdateUserProfileDto,
  ): Promise<UserProfileResponseDto> {
    const user = await this.authService.updateUserProfile(userId, dto);
    return this.authService.transformUserResponse(user);
  }

  @Throttle({
    default: {
      limit: 10,
      ttl: 60000,
    },
  })
  @Post('me/avatar/upload-url')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Request presigned URL for avatar upload',
    description:
      'Generate a presigned S3 URL for direct avatar upload. ' +
      'The URL expires in 15 minutes. Max file size: 5MB. ' +
      'Allowed formats: jpg, jpeg, png, webp, gif.',
  })
  @ApiResponse({
    status: 200,
    description: 'Presigned URL generated successfully',
    type: AvatarUploadUrlResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 400, description: 'Invalid file type or extension' })
  async requestAvatarUploadUrl(
    @GetUser('id') userId: number,
    @Body() dto: RequestAvatarUploadUrlDto,
  ): Promise<AvatarUploadUrlResponseDto> {
    return this.authService.generateAvatarUploadUrl(
      userId,
      dto.fileName,
      dto.contentType,
    );
  }

  @Throttle({
    default: {
      limit: 10,
      ttl: 60000,
    },
  })
  @Post('me/avatar/confirm')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Confirm avatar upload',
    description:
      'Confirm that the avatar has been uploaded to S3 and save the S3 key to the database. ' +
      'This endpoint verifies the file exists in S3 before saving.',
  })
  @ApiResponse({
    status: 200,
    description: 'Avatar confirmed and saved successfully',
    type: UserProfileResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 400, description: 'Invalid S3 key format' })
  @ApiResponse({ status: 404, description: 'Upload not found in S3' })
  async confirmAvatarUpload(
    @GetUser('id') userId: number,
    @Body() dto: ConfirmAvatarUploadDto,
  ): Promise<UserProfileResponseDto> {
    const user = await this.authService.confirmAvatarUpload(userId, dto.key);
    return this.authService.transformUserResponse(user);
  }

  @Throttle({
    default: {
      limit: 5,
      ttl: 60000,
    },
  })
  @Delete('me/avatar')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Delete avatar',
    description:
      'Delete the current user avatar from S3 and remove the reference from the database.',
  })
  @ApiResponse({
    status: 200,
    description: 'Avatar deleted successfully',
    type: UserProfileResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 400, description: 'User has no avatar to delete' })
  async deleteAvatar(
    @GetUser('id') userId: number,
  ): Promise<UserProfileResponseDto> {
    const user = await this.authService.deleteAvatar(userId);
    return this.authService.transformUserResponse(user);
  }

  @Throttle({
    default: {
      limit: 3,
      ttl: 60000,
    },
  })
  @Get('google')
  @ApiOperation({ summary: 'Initiate Google OAuth flow' })
  @ApiResponse({
    status: 302,
    description: 'Redirect to Google OAuth consent screen',
  })
  // eslint-disable-next-line @typescript-eslint/require-await
  async getGoogleAuthUrl(@Res() res: Response): Promise<void> {
    const url = this.googleOAuthService.getAuthorizationUrl();
    res.redirect(url);
  }

  @Throttle({
    default: {
      limit: 3,
      ttl: 60000,
    },
  })
  @Post('google/callback')
  @HttpCode(HttpStatus.OK)
  @UseGuards(GoogleAuthGuard)
  @ApiOperation({ summary: 'Google OAuth callback' })
  @ApiHeader({
    name: 'user-agent',
    required: false,
    description: 'User agent string (automatically sent by browser/client)',
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully authenticated with Google - returns HTML form',
  })
  @ApiResponse({
    status: 401,
    description: 'Google authentication failed',
  })
  async googleCallback(
    @Res() res: Response,
    @Body() googleAuthDto: GoogleAuthDto,
    @Ip() ipAddress: string,
    @Headers('user-agent') @Optional() userAgent?: string,
  ): Promise<void> {
    const authResponse = await this.googleOAuthService.handleGoogleCallback(
      googleAuthDto.code,
      ipAddress,
      userAgent,
    );

    const html = this.generateOAuthRedirectHtml(authResponse);
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  }

  @Throttle({
    default: {
      limit: 3,
      ttl: 60000,
    },
  })
  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  @ApiOperation({ summary: 'Google OAuth callback (GET)' })
  @ApiHeader({
    name: 'user-agent',
    required: false,
    description: 'User agent string (automatically sent by browser/client)',
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully authenticated with Google - returns HTML form',
  })
  async googleCallbackGet(
    @Res() res: Response,
    @Query('code') code: string,
    @Ip() ipAddress: string,
    @Headers('user-agent') @Optional() userAgent?: string,
  ): Promise<void> {
    const authResponse = await this.googleOAuthService.handleGoogleCallback(
      code,
      ipAddress,
      userAgent,
    );

    const html = this.generateOAuthRedirectHtml(authResponse);
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  }

  // ==================== EMAIL VERIFICATION ====================

  @Throttle({
    default: {
      limit: 3,
      ttl: 60000,
    },
  })
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify email with token' })
  @ApiResponse({
    status: 200,
    description: 'Email verified successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Invalid verification token',
  })
  @ApiResponse({
    status: 409,
    description: 'Token already used or expired',
  })
  async verifyEmail(
    @Body() verifyEmailDto: VerifyEmailDto,
  ): Promise<{ message: string }> {
    return this.authService.verifyEmail(verifyEmailDto.token);
  }

  @Throttle({
    default: {
      limit: 3,
      ttl: 60000,
    },
  })
  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resend verification email' })
  @ApiResponse({
    status: 200,
    description: 'Verification email sent',
  })
  @ApiResponse({
    status: 409,
    description: 'Email already verified',
  })
  async resendVerification(
    @Body() forgotPasswordDto: ForgotPasswordDto,
  ): Promise<{ message: string }> {
    return this.authService.resendVerificationEmail(forgotPasswordDto.email);
  }

  // ==================== PASSWORD RESET ====================

  @Throttle({
    default: {
      limit: 3,
      ttl: 60000,
    },
  })
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request password reset' })
  @ApiResponse({
    status: 200,
    description: 'Password reset email sent if email exists',
  })
  async forgotPassword(
    @Body() forgotPasswordDto: ForgotPasswordDto,
  ): Promise<{ message: string }> {
    return this.authService.forgotPassword(forgotPasswordDto.email);
  }

  @Throttle({
    default: {
      limit: 3,
      ttl: 60000,
    },
  })
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password with token' })
  @ApiResponse({
    status: 200,
    description: 'Password reset successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Invalid reset token',
  })
  @ApiResponse({
    status: 409,
    description: 'Token already used or expired',
  })
  async resetPassword(
    @Body() resetPasswordDto: ResetPasswordDto,
  ): Promise<{ message: string }> {
    return this.authService.resetPassword(
      resetPasswordDto.token,
      resetPasswordDto.newPassword,
    );
  }

  @Throttle({
    default: {
      limit: 3,
      ttl: 60000,
    },
  })
  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Change password (authenticated)' })
  @ApiBearerAuth('JWT-auth')
  @ApiResponse({
    status: 200,
    description: 'Password changed successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Current password incorrect or unauthorized',
  })
  async changePassword(
    @GetUser() user: User,
    @Body() changePasswordDto: ChangePasswordDto,
  ): Promise<{ message: string }> {
    return this.authService.changePassword(
      user.id,
      changePasswordDto.currentPassword,
      changePasswordDto.newPassword,
    );
  }
}
