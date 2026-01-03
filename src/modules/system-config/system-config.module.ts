import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SystemParameter } from './entities/system-parameter.entity';
import { SystemConfigService } from './system-config.service';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([SystemParameter])],
  providers: [SystemConfigService],
  exports: [SystemConfigService],
})
export class SystemConfigModule {}
