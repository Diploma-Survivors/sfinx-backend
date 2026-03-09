import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { PaginatedResultDto } from 'src/common/dto/paginated-result.dto';
import { Tag } from 'src/modules/problems/entities/tag.entity';
import { Topic } from 'src/modules/problems/entities/topic.entity';
import { Problem } from 'src/modules/problems/entities/problem.entity';
import { StorageService } from 'src/modules/storage/storage.service';
import { CreateStudyPlanDto } from '../dto/create-study-plan.dto';
import { UpdateStudyPlanDto } from '../dto/update-study-plan.dto';
import { AddStudyPlanItemDto } from '../dto/add-study-plan-item.dto';
import { FilterStudyPlanDto } from '../dto/filter-study-plan.dto';
import { ReorderItemsDto } from '../dto/reorder-items.dto';
import { StudyPlanSummaryResponseDto } from '../dto/study-plan-response.dto';
import { StudyPlan } from '../entities/study-plan.entity';
import { StudyPlanItem } from '../entities/study-plan-item.entity';
import { StudyPlanTranslation } from '../entities/study-plan-translation.entity';
import { StudyPlanStatus } from '../enums/study-plan-status.enum';
import { StudyPlanQueryService } from './study-plan-query.service';

@Injectable()
export class StudyPlanService {
  constructor(
    @InjectRepository(StudyPlan)
    private readonly studyPlanRepository: Repository<StudyPlan>,
    @InjectRepository(StudyPlanItem)
    private readonly itemRepository: Repository<StudyPlanItem>,
    @InjectRepository(StudyPlanTranslation)
    private readonly translationRepository: Repository<StudyPlanTranslation>,
    @InjectRepository(Problem)
    private readonly problemRepository: Repository<Problem>,
    @InjectRepository(Topic)
    private readonly topicRepository: Repository<Topic>,
    @InjectRepository(Tag)
    private readonly tagRepository: Repository<Tag>,
    private readonly storageService: StorageService,
    private readonly queryService: StudyPlanQueryService,
  ) {}

  // ─── Plan CRUD ────────────────────────────────────────────────────

  async create(userId: number, dto: CreateStudyPlanDto): Promise<StudyPlan> {
    const existingSlug = await this.studyPlanRepository.findOne({
      where: { slug: dto.slug },
    });
    if (existingSlug) {
      throw new BadRequestException(`Slug "${dto.slug}" already exists`);
    }

    const plan = this.studyPlanRepository.create({
      slug: dto.slug,
      difficulty: dto.difficulty,
      estimatedDays: dto.estimatedDays,
      isPremium: dto.isPremium ?? false,
      similarPlanIds: dto.similarPlanIds ?? [],
      createdById: userId,
    });

    const savedPlan = await this.studyPlanRepository.save(plan);

    if (dto.translations?.length) {
      const translations = dto.translations.map((t) =>
        this.translationRepository.create({
          studyPlanId: savedPlan.id,
          languageCode: t.languageCode,
          name: t.name,
          description: t.description,
        }),
      );
      await this.translationRepository.save(translations);
    }

    if (dto.topicIds?.length) {
      savedPlan.topics = await this.topicRepository.findBy({
        id: In(dto.topicIds),
      });
      await this.studyPlanRepository.save(savedPlan);
    }

    if (dto.tagIds?.length) {
      savedPlan.tags = await this.tagRepository.findBy({
        id: In(dto.tagIds),
      });
      await this.studyPlanRepository.save(savedPlan);
    }

    return this.findOneAdmin(savedPlan.id);
  }

  async update(id: number, dto: UpdateStudyPlanDto): Promise<StudyPlan> {
    const plan = await this.studyPlanRepository.findOne({
      where: { id },
      relations: ['translations', 'topics', 'tags'],
    });
    if (!plan) {
      throw new NotFoundException(`Study plan ${id} not found`);
    }

    if (dto.slug !== undefined) plan.slug = dto.slug;
    if (dto.difficulty !== undefined) plan.difficulty = dto.difficulty;
    if (dto.estimatedDays !== undefined) plan.estimatedDays = dto.estimatedDays;
    if (dto.isPremium !== undefined) plan.isPremium = dto.isPremium;
    if (dto.status !== undefined) plan.status = dto.status;
    if (dto.similarPlanIds !== undefined)
      plan.similarPlanIds = dto.similarPlanIds;

    if (dto.translations) {
      for (const tDto of dto.translations) {
        let translation = plan.translations.find(
          (t) => t.languageCode === tDto.languageCode,
        );

        if (translation) {
          translation.name = tDto.name;
          translation.description = tDto.description;
        } else {
          translation = this.translationRepository.create({
            studyPlanId: plan.id,
            languageCode: tDto.languageCode,
            name: tDto.name,
            description: tDto.description,
          });
        }
        await this.translationRepository.save(translation);
      }
    }

    if (dto.topicIds) {
      plan.topics = await this.topicRepository.findBy({
        id: In(dto.topicIds),
      });
    }

    if (dto.tagIds) {
      plan.tags = await this.tagRepository.findBy({
        id: In(dto.tagIds),
      });
    }

    await this.studyPlanRepository.save(plan);
    return this.findOneAdmin(id);
  }

  async remove(id: number): Promise<void> {
    const result = await this.studyPlanRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Study plan ${id} not found`);
    }
  }

  async publish(id: number): Promise<StudyPlan> {
    const plan = await this.studyPlanRepository.findOne({
      where: { id },
      relations: ['items'],
    });
    if (!plan) {
      throw new NotFoundException(`Study plan ${id} not found`);
    }
    if (!plan.items?.length) {
      throw new BadRequestException('Cannot publish a plan with no problems');
    }
    plan.status = StudyPlanStatus.PUBLISHED;
    await this.studyPlanRepository.save(plan);
    return this.findOneAdmin(id);
  }

  async archive(id: number): Promise<StudyPlan> {
    const plan = await this.studyPlanRepository.findOne({ where: { id } });
    if (!plan) {
      throw new NotFoundException(`Study plan ${id} not found`);
    }
    plan.status = StudyPlanStatus.ARCHIVED;
    await this.studyPlanRepository.save(plan);
    return this.findOneAdmin(id);
  }

  async uploadCoverImage(
    id: number,
    file: Express.Multer.File,
  ): Promise<StudyPlan> {
    const plan = await this.studyPlanRepository.findOne({ where: { id } });
    if (!plan) {
      throw new NotFoundException(`Study plan ${id} not found`);
    }

    const fileExtension =
      file.originalname.split('.').pop()?.toLowerCase() || 'png';
    const timestamp = Date.now();
    const key = `study-plans/${id}/${timestamp}.${fileExtension}`;

    await this.storageService.uploadFile(key, file.buffer, file.mimetype);

    plan.coverImageKey = key;
    return this.studyPlanRepository.save(plan);
  }

  async findOneAdmin(id: number): Promise<StudyPlan> {
    const plan = await this.studyPlanRepository.findOne({
      where: { id },
      relations: [
        'translations',
        'items',
        'items.problem',
        'topics',
        'tags',
        'createdBy',
      ],
    });
    if (!plan) {
      throw new NotFoundException(`Study plan ${id} not found`);
    }
    return plan;
  }

  async findAllAdmin(
    query: FilterStudyPlanDto,
    lang: string = 'en',
  ): Promise<PaginatedResultDto<StudyPlanSummaryResponseDto>> {
    const qb = this.studyPlanRepository
      .createQueryBuilder('sp')
      .leftJoinAndSelect('sp.translations', 'spt')
      .leftJoinAndSelect('sp.topics', 'topics')
      .leftJoinAndSelect('sp.tags', 'tags');

    this.queryService.applyFilters(qb, query, lang);
    this.queryService.applySorting(qb, query, lang);
    qb.skip(query.skip).take(query.take);

    const [data, total] = await qb.getManyAndCount();

    return PaginatedResultDto.fromFindAndCount(
      [this.queryService.mapPlansWithTranslation(data, lang), total],
      { page: query.page ?? 1, limit: query.limit ?? 20 },
    );
  }

  // ─── Item management ──────────────────────────────────────────────

  async addItem(
    planId: number,
    dto: AddStudyPlanItemDto,
  ): Promise<StudyPlanItem> {
    const plan = await this.studyPlanRepository.findOne({
      where: { id: planId },
    });
    if (!plan) {
      throw new NotFoundException(`Study plan ${planId} not found`);
    }

    const problem = await this.problemRepository.findOne({
      where: { id: dto.problemId },
    });
    if (!problem) {
      throw new NotFoundException(`Problem ${dto.problemId} not found`);
    }

    const existing = await this.itemRepository.findOne({
      where: { studyPlanId: planId, problemId: dto.problemId },
    });
    if (existing) {
      throw new BadRequestException(
        `Problem ${dto.problemId} already exists in this plan`,
      );
    }

    const item = this.itemRepository.create({
      studyPlanId: planId,
      problemId: dto.problemId,
      dayNumber: dto.dayNumber,
      orderIndex: dto.orderIndex ?? 0,
      note: dto.note ?? null,
    });

    return this.itemRepository.save(item);
  }

  async removeItem(planId: number, itemId: number): Promise<void> {
    const result = await this.itemRepository.delete({
      id: itemId,
      studyPlanId: planId,
    });
    if (result.affected === 0) {
      throw new NotFoundException(`Item ${itemId} not found in plan ${planId}`);
    }
  }

  async reorderItems(planId: number, dto: ReorderItemsDto): Promise<void> {
    const plan = await this.studyPlanRepository.findOne({
      where: { id: planId },
    });
    if (!plan) {
      throw new NotFoundException(`Study plan ${planId} not found`);
    }

    for (const item of dto.items) {
      await this.itemRepository.update(
        { id: item.id, studyPlanId: planId },
        { dayNumber: item.dayNumber, orderIndex: item.orderIndex },
      );
    }
  }
}
