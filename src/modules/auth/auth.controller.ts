import type { Response } from 'express';

import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Ip,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { plainToInstance } from 'class-transformer';

import { AppConfig } from '../../config/app.config';

import { GetUser } from '../../common';
import { AuthService } from './auth.service';
import { AuthResponseDto } from './dto/auth-response.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { GoogleAuthDto } from './dto/google-auth.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
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
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Đang chuyển hướng...</title>
    <style>
        body {
            font-family: 'Geist Sans', Arial, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            background: linear-gradient(
                to bottom right,
                rgb(248, 250, 252),
                rgb(241, 245, 249),
                rgb(248, 250, 252)
            );
            background-attachment: fixed;
        }
        .loading {
            text-align: center;
            padding: 24px;
            background: white;
            border-radius: 0.625rem;
            box-shadow: 0 4px 20px rgba(0,0,0,0.08);
            border: 1px solid rgba(226, 232, 240, 1);
            max-width: 90%;
            width: 400px;
        }
        .spinner {
            border: 4px solid rgba(241, 245, 249, 1);
            border-top: 4px solid rgb(22, 163, 74);
            border-radius: 50%;
            width: 40px;
            height: 40px;
            animation: spin 1s linear infinite;
            margin: 0 auto 20px;
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        h2 {
            color: rgb(15, 23, 42);
            font-weight: 600;
            margin-bottom: 12px;
        }
        p {
            color: rgb(71, 85, 105);
            margin-bottom: 12px;
        }
        small {
            color: rgb(100, 116, 139);
        }
        button {
            padding: 10px 20px;
            background: rgb(22, 163, 74);
            color: white;
            border: none;
            border-radius: 0.5rem;
            cursor: pointer;
            font-weight: 500;
            transition: all 0.2s ease;
        }
        button:hover {
            background: rgb(21, 128, 61);
            box-shadow: 0 2px 10px rgba(22, 163, 74, 0.2);
        }
        @media (prefers-color-scheme: dark) {
            body {
                background: linear-gradient(
                    to bottom right,
                    rgb(15, 23, 42),
                    rgb(30, 41, 59),
                    rgb(15, 23, 42)
                );
            }
            .loading {
                background: rgb(30, 41, 59);
                border-color: rgb(51, 65, 85);
            }
            h2 {
                color: rgb(241, 245, 249);
            }
            p {
                color: rgb(148, 163, 184);
            }
            small {
                color: rgb(100, 116, 139);
            }
            .spinner {
                border-color: rgb(51, 65, 85);
                border-top-color: rgb(34, 197, 94);
            }
        }
    </style>
</head>
<body>
    <div class="loading">
        <div class="spinner"></div>
        <h2>Đang chuyển hướng...</h2>
        <p>Vui lòng đợi trong khi chúng tôi xử lý xác thực của bạn...</p>
        <p><small>Nếu trang này không tự động chuyển hướng, vui lòng nhấn nút bên dưới.</small></p>
        
        <form id="postRedirectForm" action="${handshakeUrl}" method="POST" style="margin-top: 20px;">
            <input type="hidden" name="accessToken" value="${authResponse.accessToken}" />
            <input type="hidden" name="refreshToken" value="${authResponse.refreshToken}" />
            <input type="hidden" name="userId" value="${authResponse.user.id}" />
            <input type="hidden" name="expiresIn" value="${authResponse.expiresInSeconds}" />
            <button type="submit">
                Tiếp tục
            </button>
        </form>
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
    @Headers('user-agent') userAgent: string,
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
    @Headers('user-agent') userAgent: string,
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
      limit: 3,
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
  // eslint-disable-next-line @typescript-eslint/require-await
  async getCurrentUser(@GetUser() user: User): Promise<UserProfileResponseDto> {
    return plainToInstance(UserProfileResponseDto, user);
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
  @ApiResponse({
    status: 200,
    description: 'Successfully authenticated with Google - returns HTML form',
  })
  @ApiResponse({
    status: 401,
    description: 'Google authentication failed',
  })
  async googleCallback(
    @Body() googleAuthDto: GoogleAuthDto,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent: string,
    @Res() res: Response,
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
  @ApiResponse({
    status: 200,
    description: 'Successfully authenticated with Google - returns HTML form',
  })
  async googleCallbackGet(
    @Query('code') code: string,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent: string,
    @Res() res: Response,
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
