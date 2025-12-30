import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../auth/entities/user.entity';
import { UserProfileResponseDto } from '../auth/dto/user-profile-response.dto';
import { plainToInstance } from 'class-transformer';
import { StorageService } from '../storage/storage.service';

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
