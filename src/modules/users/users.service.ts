import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { plainToInstance } from 'class-transformer';
import { Repository } from 'typeorm';
import { PaginatedResultDto } from '../../common/dto/paginated-result.dto';
import { UserProfileResponseDto } from '../auth/dto/user-profile-response.dto';
import { User } from '../auth/entities/user.entity';
import { ContestParticipant } from '../contest/entities/contest-participant.entity';
import { CacheKeys, RedisService } from '../redis';
import { StorageService } from '../storage/storage.service';
import { ContestHistoryEntryDto } from './dto/contest-history.dto';
import { ContestRatingLeaderboardEntryDto } from './dto/contest-rating-leaderboard.dto';
import { GetUsersQueryDto } from './dto/get-users-query.dto';
import { SystemUserStatisticsDto } from './dto/system-user-statistics.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(ContestParticipant)
    private readonly contestParticipantRepository: Repository<ContestParticipant>,
    private readonly storageService: StorageService,
    private readonly redisService: RedisService,
  ) {}

  async getUserProfile(userId: number): Promise<UserProfileResponseDto> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['role'],
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    const member = userId.toString();
    const [problemRankRaw, contestRankRaw] = await Promise.all([
      this.redisService.zrevrank(
        CacheKeys.globalRanking.problemBased(),
        member,
      ),
      this.redisService.zrevrank(
        CacheKeys.globalRanking.contestBased(),
        member,
      ),
    ]);

    const dto = this.transformUserResponse(user);
    dto.problemRank = problemRankRaw !== null ? problemRankRaw + 1 : null;
    dto.contestRank = contestRankRaw !== null ? contestRankRaw + 1 : null;

    return dto;
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
      status,
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

    if (status) {
      if (status === 'active') {
        queryBuilder
          .andWhere('user.isActive = :isActive', { isActive: true })
          .andWhere('user.isBanned = :isBanned', { isBanned: false });
      } else if (status === 'banned') {
        queryBuilder
          .andWhere('user.isActive = :isActive', { isActive: true })
          .andWhere('user.isBanned = :isBanned', { isBanned: true });
      } else if (status === 'not_verified') {
        queryBuilder.andWhere('user.isActive = :isActive', { isActive: false });
      }
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
    user.isActive = true; // Banned users are still "active" in terms of account existence, just banned flag is true
    user.isBanned = true;
    user.bannedAt = new Date();
    await this.userRepository.save(user);
  }

  async unbanUser(userId: number): Promise<void> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }
    user.isActive = true;
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

  /**
   * Get paginated global contest rating leaderboard from Redis ZSET.
   */
  async getContestRatingLeaderboard(
    page: number,
    limit: number,
  ): Promise<PaginatedResultDto<ContestRatingLeaderboardEntryDto>> {
    const key = CacheKeys.globalRanking.contestBased();
    const skip = (page - 1) * limit;

    const [total, raw] = await Promise.all([
      this.redisService.zcard(key),
      this.redisService.zrevrange(key, skip, skip + limit - 1, true),
    ]);

    if (!raw || raw.length === 0) {
      return {
        data: [],
        meta: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
          hasNextPage: false,
          hasPreviousPage: page > 1,
        },
      };
    }

    // zrevrange WITHSCORES returns alternating [member, score, member, score, ...]
    const entries: Array<{ userId: number; rating: number }> = [];
    for (let i = 0; i < raw.length; i += 2) {
      entries.push({
        userId: parseInt(raw[i], 10),
        rating: parseFloat(raw[i + 1]),
      });
    }

    const userIds = entries.map((e) => e.userId);
    const users = await this.userRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.statistics', 'statistics')
      .where('user.id IN (:...userIds)', { userIds })
      .getMany();

    const userMap = new Map(users.map((u) => [u.id, u]));

    const data: ContestRatingLeaderboardEntryDto[] = entries.map(
      (entry, idx) => {
        const user = userMap.get(entry.userId);
        let avatarUrl: string | null = null;
        if (user?.avatarKey && this.isS3Key(user.avatarKey)) {
          avatarUrl = this.storageService.getCloudFrontUrl(user.avatarKey);
        } else if (user?.avatarKey) {
          avatarUrl = user.avatarKey;
        }

        return {
          rank: skip + idx + 1,
          user: {
            id: entry.userId,
            username: user?.username ?? '',
            fullName: user?.fullName ?? null,
            avatarUrl,
          },
          contestRating: entry.rating,
          contestsParticipated: user?.statistics?.contestsParticipated ?? 0,
        };
      },
    );

    const totalPages = Math.ceil(total / limit);
    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    };
  }

  /**
   * Get a user's contest rating history (past rated contests).
   */
  async getContestHistory(userId: number): Promise<ContestHistoryEntryDto[]> {
    const rows = await this.contestParticipantRepository
      .createQueryBuilder('cp')
      .innerJoinAndSelect('cp.contest', 'contest')
      .where('cp.userId = :userId', { userId })
      .andWhere('cp.ratingAfter IS NOT NULL')
      .orderBy('contest.endTime', 'ASC')
      .getMany();

    return rows.map((row) => ({
      contestId: row.contestId,
      contestTitle: row.contest.title,
      contestEndTime: row.contest.endTime,
      contestRank: row.contestRank!,
      ratingBefore: row.ratingBefore!,
      ratingAfter: row.ratingAfter!,
      ratingDelta: row.ratingDelta!,
    }));
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
