import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ProgrammingLanguage } from './entities/programming-language.entity';
import { ProgrammingLanguageController } from './programming-language.controller';
import { ProgrammingLanguageService } from './programming-language.service';

/**
 * Programming Language Module
 * Provides CRUD operations for programming languages with caching
 */
@Module({
  imports: [TypeOrmModule.forFeature([ProgrammingLanguage])],
  controllers: [ProgrammingLanguageController],
  providers: [ProgrammingLanguageService],
  exports: [ProgrammingLanguageService],
})
export class ProgrammingLanguageModule {}
