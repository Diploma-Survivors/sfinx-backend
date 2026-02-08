import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Problem } from '../problems/entities/problem.entity';
import { FavoriteListController } from './controllers/favorite-list.controller';
import { FavoriteList } from './entities/favorite-list.entity';
import { FavoriteListService } from './services/favorite-list.service';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [TypeOrmModule.forFeature([FavoriteList, Problem]), StorageModule],
  controllers: [FavoriteListController],
  providers: [FavoriteListService],
  exports: [FavoriteListService],
})
export class FavoriteListModule {}
