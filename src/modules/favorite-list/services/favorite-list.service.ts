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

@Injectable()
export class FavoriteListService {
  constructor(
    @InjectRepository(FavoriteList)
    private readonly favoriteListRepository: Repository<FavoriteList>,
    @InjectRepository(Problem)
    private readonly problemRepository: Repository<Problem>,
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

  async getProblems(listId: number, userId?: number): Promise<Problem[]> {
    const list = await this.favoriteListRepository.findOne({
      where: { id: listId },
      relations: ['problems', 'problems.tags', 'problems.topics'],
    });

    if (!list) {
      throw new NotFoundException(`List with ID ${listId} not found`);
    }

    if (!list.isPublic && list.userId !== userId) {
      throw new ForbiddenException('You do not have access to this list');
    }

    return list.problems;
  }

  async findPublicLists(): Promise<FavoriteList[]> {
    return await this.favoriteListRepository.find({
      where: { isPublic: true },
      relations: ['user', 'problems'],
      order: { createdAt: 'DESC' },
    });
  }

  async findUserPublicLists(targetUserId: number): Promise<FavoriteList[]> {
    return await this.favoriteListRepository.find({
      where: { userId: targetUserId, isPublic: true },
      relations: ['problems'],
      order: { createdAt: 'DESC' },
    });
  }
}
