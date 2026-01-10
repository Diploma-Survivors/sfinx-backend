import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../auth/entities/user.entity';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { SubmissionsModule } from '../submissions/submissions.module';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [TypeOrmModule.forFeature([User]), StorageModule, SubmissionsModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
