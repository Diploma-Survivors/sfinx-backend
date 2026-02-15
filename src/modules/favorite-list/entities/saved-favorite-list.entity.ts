import { ApiProperty } from '@nestjs/swagger';
import { User } from 'src/modules/auth/entities/user.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { FavoriteList } from './favorite-list.entity';

@Entity('saved_favorite_lists')
@Unique(['userId', 'favoriteListId'])
export class SavedFavoriteList {
  @ApiProperty({ description: 'Unique identifier' })
  @PrimaryGeneratedColumn('increment')
  id: number;

  @ApiProperty({ description: 'User who saved the list' })
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ApiProperty({ description: 'User ID' })
  @Column({ name: 'user_id' })
  userId: number;

  @ApiProperty({ description: 'The favorite list being saved' })
  @ManyToOne(() => FavoriteList, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'favorite_list_id' })
  favoriteList: FavoriteList;

  @ApiProperty({ description: 'Favorite List ID' })
  @Column({ name: 'favorite_list_id' })
  favoriteListId: number;

  @ApiProperty({ description: 'When the list was saved' })
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
