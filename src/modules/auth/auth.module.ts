import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule, JwtModuleOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';

import { JwtConfig } from 'src/config';
import { Role } from '../rbac/entities/role.entity';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { RefreshToken } from './entities/refresh-token.entity';
import { User } from './entities/user.entity';
import { CaslGuard } from './guards/casl.guard';
import { PermissionsGuard } from './guards/permissions.guard';
import { RolesGuard } from './guards/roles.guard';
import { GoogleOAuthService } from './services/google-oauth.service';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, RefreshToken, Role]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const { privateKey, publicKey, algorithm, accessExpiresInMs } =
          configService.getOrThrow<JwtConfig>('jwt');

        return {
          privateKey,
          publicKey,
          signOptions: {
            expiresIn: `${accessExpiresInMs}ms`,
            algorithm,
          },
          verifyOptions: {
            algorithms: [algorithm],
          },
        } as JwtModuleOptions;
      },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    GoogleOAuthService,
    JwtStrategy,
    RolesGuard,
    PermissionsGuard,
    CaslGuard,
  ],
  exports: [AuthService, JwtStrategy, PassportModule],
})
export class AuthModule {}
