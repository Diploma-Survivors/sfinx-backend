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
import { GoogleAuthDto } from './dto/google-auth.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { UserProfileResponseDto } from './dto/user-profile-response.dto';
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
    const handshakeUrl = `${frontendUrl}/api/auth/handshake`;

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Redirecting...</title>
    <style>
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            text-align: center; 
            padding-top: 50px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            margin: 0;
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
        }
        .container {
            background: rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(10px);
            border-radius: 16px;
            padding: 40px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
        }
        h3 { 
            margin: 0 0 16px 0;
            font-size: 24px;
            font-weight: 600;
        }
        p { 
            margin: 0;
            opacity: 0.9;
            font-size: 16px;
        }
        .spinner {
            margin: 24px auto;
            width: 40px;
            height: 40px;
            border: 4px solid rgba(255, 255, 255, 0.3);
            border-top-color: white;
            border-radius: 50%;
            animation: spin 1s linear infinite;
        }
        @keyframes spin {
            to { transform: rotate(360deg); }
        }
        .btn { 
            padding: 12px 24px;
            background: white;
            color: #667eea;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-size: 16px;
            font-weight: 600;
            margin-top: 16px;
            transition: transform 0.2s;
        }
        .btn:hover {
            transform: translateY(-2px);
        }
    </style>
</head>
<body>
    <div class="container">
        <h3>Đang chuyển hướng về ứng dụng...</h3>
        <div class="spinner"></div>
        <p>Vui lòng không tắt trình duyệt.</p>

        <form id="postRedirectForm" action="${handshakeUrl}" method="POST">
            <input type="hidden" name="accessToken" value="${authResponse.accessToken}" />
            <input type="hidden" name="refreshToken" value="${authResponse.refreshToken}" />
            <input type="hidden" name="userId" value="${authResponse.user.id}" />
            <input type="hidden" name="expiresIn" value="${authResponse.expiresInSeconds}" />
            
            <noscript>
                <p style="margin-top: 24px;">Nếu trình duyệt không tự chuyển, vui lòng nhấn nút bên dưới:</p>
                <button type="submit" class="btn">Tiếp tục</button>
            </noscript>
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
}
