import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SystemParameter } from './entities/system-parameter.entity';
import { SystemConfigService } from './system-config.service';
import { SystemConfigController } from './system-config.controller';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([SystemParameter])],
  controllers: [SystemConfigController],
  providers: [SystemConfigService],
  exports: [SystemConfigService],
})
export class SystemConfigModule {}
