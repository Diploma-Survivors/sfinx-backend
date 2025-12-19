import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RbacService } from './rbac.service';
import { Role } from './entities/role.entity';
import { Permission } from './entities/permission.entity';
import { CaslModule } from './casl/casl.module';
import { CaslAbilityFactory } from './casl/casl-ability.factory';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([Role, Permission]), CaslModule],
  providers: [RbacService, CaslAbilityFactory],
  exports: [RbacService, CaslModule, CaslAbilityFactory],
})
export class RbacModule {}
