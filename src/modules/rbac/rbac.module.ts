import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RbacService } from './rbac.service';
import { Role } from './entities/role.entity';
import { Permission } from './entities/permission.entity';
import { CaslModule } from './casl/casl.module';
import { CaslAbilityFactory } from './casl/casl-ability.factory';
import { RolesController } from './controllers/roles.controller';
import { PermissionsController } from './controllers/permissions.controller';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([Role, Permission]), CaslModule],
  controllers: [RolesController, PermissionsController],
  providers: [RbacService, CaslAbilityFactory],
  exports: [RbacService, CaslModule, CaslAbilityFactory],
})
export class RbacModule {}
