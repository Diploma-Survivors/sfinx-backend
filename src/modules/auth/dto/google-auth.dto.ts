import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

/**
 * DTO for Google OAuth callback with authorization code
 */
export class GoogleAuthDto {
  @ApiProperty({
    description: 'Authorization code from Google OAuth',
    example: '4/0AeanU4ZpXXXXXXXXXXXXXXXXXXXXXXXXXXX',
  })
  @IsString()
  @IsNotEmpty()
  code: string;
}

/**
 * Response from Google token endpoint
 */
export interface GoogleTokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
  refresh_token?: string;
  id_token?: string;
}

/**
 * Google user info from userinfo endpoint
 */
export interface GoogleUserInfo {
  id: string; // Google user ID
  email: string;
  verified_email: boolean;
  name: string;
  given_name: string;
  family_name: string;
  picture: string;
  locale: string;
}
