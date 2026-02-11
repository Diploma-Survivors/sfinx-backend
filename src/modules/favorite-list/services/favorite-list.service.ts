import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Problem } from '../../problems/entities/problem.entity';
import { CreateFavoriteListDto } from '../dto/create-favorite-list.dto';
import { UpdateFavoriteListDto } from '../dto/update-favorite-list.dto';
import { FavoriteList } from '../entities/favorite-list.entity';
import { ProgressStatus } from '../../submissions/enums/progress-status.enum';
import { StorageService } from '../../storage/storage.service';

import { SavedFavoriteList } from '../entities/saved-favorite-list.entity';

@Injectable()
export class FavoriteListService {
  constructor(
    @InjectRepository(FavoriteList)
    private readonly favoriteListRepository: Repository<FavoriteList>,
    @InjectRepository(Problem)
    private readonly problemRepository: Repository<Problem>,
    @InjectRepository(SavedFavoriteList)
    private readonly savedFavoriteListRepository: Repository<SavedFavoriteList>,
    private readonly storageService: StorageService,
  ) {}

  async create(
    userId: number,
    createFavoriteListDto: CreateFavoriteListDto,
  ): Promise<FavoriteList> {
    const list = this.favoriteListRepository.create({
      ...createFavoriteListDto,
      userId,
      icon: createFavoriteListDto.icon || '📝',
      isPublic: createFavoriteListDto.isPublic || false,
    });

    return await this.favoriteListRepository.save(list);
  }

  async findAllByUser(userId: number): Promise<FavoriteList[]> {
    return await this.favoriteListRepository.find({
      where: { userId },
      relations: ['problems'],
      order: { isDefault: 'DESC', createdAt: 'ASC' },
    });
  }

  async findOne(id: number, userId?: number): Promise<FavoriteList> {
    const list = await this.favoriteListRepository.findOne({
      where: { id },
      relations: ['problems', 'user'],
    });

    if (!list) {
      throw new NotFoundException(`List with ID ${id} not found`);
    }

    if (!list.isPublic && list.userId !== userId) {
      throw new ForbiddenException('You do not have access to this list');
    }

    return list;
  }

  async update(
    id: number,
    userId: number,
    updateFavoriteListDto: UpdateFavoriteListDto,
  ): Promise<FavoriteList> {
    const list = await this.favoriteListRepository.findOne({
      where: { id },
    });

    if (!list) {
      throw new NotFoundException(`List with ID ${id} not found`);
    }

    if (list.userId !== userId) {
      throw new ForbiddenException('You can only update your own lists');
    }

    Object.assign(list, updateFavoriteListDto);
    return await this.favoriteListRepository.save(list);
  }

  async remove(id: number, userId: number): Promise<void> {
    const list = await this.favoriteListRepository.findOne({
      where: { id },
    });

    if (!list) {
      throw new NotFoundException(`List with ID ${id} not found`);
    }

    if (list.userId !== userId) {
      throw new ForbiddenException('You can only delete your own lists');
    }

    if (list.isDefault) {
      throw new BadRequestException('Cannot delete the default Favorite list');
    }

    await this.favoriteListRepository.remove(list);
  }

  async addProblem(
    listId: number,
    problemId: number,
    userId: number,
  ): Promise<FavoriteList> {
    const list = await this.favoriteListRepository.findOne({
      where: { id: listId },
      relations: ['problems'],
    });

    if (!list) {
      throw new NotFoundException(`List with ID ${listId} not found`);
    }

    if (list.userId !== userId) {
      throw new ForbiddenException('You can only modify your own lists');
    }

    const problem = await this.problemRepository.findOne({
      where: { id: problemId },
    });

    if (!problem) {
      throw new NotFoundException(`Problem with ID ${problemId} not found`);
    }

    const alreadyExists = list.problems.some((p) => p.id === problemId);
    if (alreadyExists) {
      throw new BadRequestException('Problem already exists in this list');
    }

    list.problems.push(problem);
    return await this.favoriteListRepository.save(list);
  }

  async removeProblem(
    listId: number,
    problemId: number,
    userId: number,
  ): Promise<FavoriteList> {
    const list = await this.favoriteListRepository.findOne({
      where: { id: listId },
      relations: ['problems'],
    });

    if (!list) {
      throw new NotFoundException(`List with ID ${listId} not found`);
    }

    if (list.userId !== userId) {
      throw new ForbiddenException('You can only modify your own lists');
    }

    list.problems = list.problems.filter((p) => p.id !== problemId);
    return await this.favoriteListRepository.save(list);
  }

  async getProblems(
    listId: number,
    userId?: number,
  ): Promise<(Problem & { status?: ProgressStatus | null })[]> {
    const list = await this.favoriteListRepository.findOne({
      where: { id: listId },
      relations: ['problems'],
    });

    if (!list) {
      throw new NotFoundException(`List with ID ${listId} not found`);
    }

    if (!list.isPublic && list.userId !== userId) {
      throw new ForbiddenException('You do not have access to this list');
    }

    if (!list.problems || list.problems.length === 0) {
      return [];
    }

    const problemIds = list.problems.map((p) => p.id);

    const queryBuilder = this.problemRepository
      .createQueryBuilder('problem')
      .leftJoinAndSelect('problem.tags', 'tags')
      .leftJoinAndSelect('problem.topics', 'topics')
      .where('problem.id IN (:...problemIds)', { problemIds });

    if (userId) {
      queryBuilder.leftJoinAndSelect(
        'problem.userProgress',
        'user_progress',
        'user_progress.userId = :userId',
        { userId },
      );
    }

    const problems = await queryBuilder.getMany();

    // Map status from userProgress
    if (userId) {
      problems.forEach((problem) => {
        const progress = problem.userProgress?.[0];
        (problem as Problem & { status?: ProgressStatus | null }).status =
          progress?.status ?? null;
        delete problem.userProgress;
      });
    }

    return problems as (Problem & { status?: ProgressStatus | null })[];
  }

  async saveList(listId: number, userId: number): Promise<void> {
    const list = await this.favoriteListRepository.findOne({
      where: { id: listId },
    });

    if (!list) {
      throw new NotFoundException(`List with ID ${listId} not found`);
    }

    if (!list.isPublic && list.userId !== userId) {
      throw new ForbiddenException('You do not have access to this list');
    }

    if (list.userId === userId) {
      throw new BadRequestException('You cannot save your own list');
    }

    const existing = await this.savedFavoriteListRepository.findOne({
      where: { userId, favoriteListId: listId },
    });

    if (existing) {
      return; // Already saved
    }

    const savedList = this.savedFavoriteListRepository.create({
      userId,
      favoriteListId: listId,
    });

    await this.savedFavoriteListRepository.save(savedList);
  }

  async unsaveList(listId: number, userId: number): Promise<void> {
    const savedList = await this.savedFavoriteListRepository.findOne({
      where: { userId, favoriteListId: listId },
    });

    if (!savedList) {
      throw new NotFoundException('List not found in your saved lists');
    }

    await this.savedFavoriteListRepository.remove(savedList);
  }

  async getSavedLists(userId: number): Promise<FavoriteList[]> {
    const savedLists = await this.savedFavoriteListRepository.find({
      where: { userId },
      relations: ['favoriteList', 'favoriteList.user', 'favoriteList.problems'],
      order: { createdAt: 'DESC' },
    });

    return savedLists.map((saved) => saved.favoriteList);
  }

  async findPublicLists(limit = 10): Promise<FavoriteList[]> {
    return await this.favoriteListRepository.find({
      where: { isPublic: true },
      relations: ['user', 'problems'],
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  async findUserPublicLists(targetUserId: number): Promise<FavoriteList[]> {
    return await this.favoriteListRepository.find({
      where: { userId: targetUserId, isPublic: true },
      relations: ['problems'],
      order: { createdAt: 'DESC' },
    });
  }

  async uploadIcon(
    listId: number,
    userId: number,
    file: Express.Multer.File,
  ): Promise<FavoriteList> {
    const list = await this.favoriteListRepository.findOne({
      where: { id: listId },
    });

    if (!list) {
      throw new NotFoundException(`List with ID ${listId} not found`);
    }

    if (list.userId !== userId) {
      throw new ForbiddenException('You can only update your own lists');
    }

    // Generate S3 key
    const fileExtension =
      file.originalname.split('.').pop()?.toLowerCase() || 'png';
    const timestamp = Date.now();
    const key = `favorite-lists/${listId}/${timestamp}.${fileExtension}`;

    // Upload to S3
    await this.storageService.uploadFile(key, file.buffer, file.mimetype);

    // Update list icon
    list.icon = this.storageService.getCloudFrontUrl(key);
    return await this.favoriteListRepository.save(list);
  }
}
