import { ApiProperty } from '@nestjs/swagger';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinTable,
  ManyToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Permission } from './permission.entity';

@Entity('roles')
export class Role {
  @ApiProperty({ description: 'Unique identifier' })
  @PrimaryGeneratedColumn('increment')
  id: number;

  @ApiProperty({ description: 'Role name' })
  @Column({ unique: true, length: 50 })
  name: string;

  @ApiProperty({ description: 'Role slug (URL-friendly name)' })
  @Column({ unique: true, length: 50 })
  slug: string;

  @ApiProperty({ description: 'Role description', required: false })
  @Column({ type: 'text', nullable: true })
  description: string;

  @ApiProperty({
    description: 'Whether this is a system role (cannot be deleted)',
  })
  @Column({ name: 'is_system_role', default: false })
  isSystemRole: boolean;

  @ApiProperty({
    description: 'Priority level (higher = more permissions in conflicts)',
  })
  @Column({ default: 0 })
  priority: number;

  @ApiProperty({
    description: 'Permissions associated with this role',
    type: () => [Permission],
  })
  @ManyToMany(() => Permission)
  @JoinTable({
    name: 'role_permissions',
    joinColumn: { name: 'role_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'permission_id', referencedColumnName: 'id' },
  })
  permissions: Permission[];

  @ApiProperty({ description: 'Creation timestamp' })
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
