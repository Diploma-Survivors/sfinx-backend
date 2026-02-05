import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../auth/entities/user.entity';
import { UserProfileResponseDto } from '../auth/dto/user-profile-response.dto';
import { plainToInstance } from 'class-transformer';
import { StorageService } from '../storage/storage.service';
import { GetUsersQueryDto } from './dto/get-users-query.dto';
import { PaginatedResultDto } from '../../common/dto/paginated-result.dto';
import { SystemUserStatisticsDto } from './dto/system-user-statistics.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly storageService: StorageService,
  ) {}

  async getUserProfile(userId: number): Promise<UserProfileResponseDto> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['role'], // Add other relations if needed
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    return this.transformUserResponse(user);
  }

  async getUserPermisison(userId: number) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['role', 'role.permissions'],
    });
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }
    return user.role.permissions;
  }

  async findAll(query: GetUsersQueryDto): Promise<PaginatedResultDto<User>> {
    const {
      page = 1,
      limit = 10,
      search,
      isActive,
      isPremium,
      emailVerified,
    } = query;
    const skip = (page - 1) * limit;

    const queryBuilder = this.userRepository.createQueryBuilder('user');

    if (search) {
      queryBuilder.andWhere(
        '(user.username ILIKE :search OR user.email ILIKE :search OR user.fullName ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    if (isActive !== undefined) {
      queryBuilder.andWhere('user.isActive = :isActive', { isActive });
    }

    if (isPremium !== undefined) {
      queryBuilder.andWhere('user.isPremium = :isPremium', { isPremium });
    }

    if (emailVerified !== undefined) {
      queryBuilder.andWhere('user.emailVerified = :emailVerified', {
        emailVerified,
      });
    }

    const [users, total] = await queryBuilder
      .skip(skip)
      .take(limit)
      .orderBy('user.id', 'DESC')
      .getManyAndCount();

    const DEFAULT_AVATAR =
      'https://cdn.pixabay.com/photo/2018/11/13/21/43/avatar-3814049_1280.png';

    const usersWithAvatar = users.map((user) => {
      const userWithAvatar = user as User & { avatarUrl?: string };
      if (!user.avatarKey && !userWithAvatar.avatarUrl) {
        userWithAvatar.avatarUrl = DEFAULT_AVATAR;
      }
      return user;
    });

    return {
      data: usersWithAvatar,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page < Math.ceil(total / limit),
        hasPreviousPage: page > 1,
      },
    };
  }

  async banUser(userId: number): Promise<void> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }
    user.isBanned = true;
    user.bannedAt = new Date();
    await this.userRepository.save(user);
  }

  async unbanUser(userId: number): Promise<void> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }
    user.isBanned = false;
    user.bannedAt = null;
    await this.userRepository.save(user);
  }

  async getSystemStatistics(): Promise<SystemUserStatisticsDto> {
    const total = await this.userRepository.count();
    const active = await this.userRepository.count({
      where: { isActive: true },
    });
    const premium = await this.userRepository.count({
      where: { isPremium: true },
    });
    const banned = await this.userRepository.count({
      where: { isBanned: true },
    });

    return {
      total,
      active,
      premium,
      banned,
    };
  }

  transformUserResponse(user: User): UserProfileResponseDto {
    const dto = plainToInstance(UserProfileResponseDto, user);

    if (dto.avatarKey && this.isS3Key(dto.avatarKey)) {
      (dto as UserProfileResponseDto & { avatarUrl?: string }).avatarUrl =
        this.storageService.getCloudFrontUrl(dto.avatarKey);
    }

    return dto;
  }

  private isS3Key(value: string): boolean {
    if (!value) return false;
    return !value.startsWith('http://') && !value.startsWith('https://');
  }
}
