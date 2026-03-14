import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../auth/entities/user.entity';
import { Language } from '../auth/enums';
import { NotificationEvent } from '../notifications/enums/notification-event.enum';
import { NotificationType } from '../notifications/enums/notification-type.enum';
import { NotificationsService } from '../notifications/notifications.service';
import { StorageService } from '../storage/storage.service';
import { CreateProblemReportDto } from './dto/create-problem-report.dto';
import { UpdateProblemReportDto } from './dto/update-problem-report.dto';
import { ProblemReport } from './entities/problem-report.entity';

@Injectable()
export class ProblemReportsService {
  constructor(
    @InjectRepository(ProblemReport)
    private problemReportsRepository: Repository<ProblemReport>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private readonly storageService: StorageService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async create(createDto: CreateProblemReportDto, userId: number) {
    const report = this.problemReportsRepository.create({
      ...createDto,
      userId,
    });
    const savedReport = await this.problemReportsRepository.save(report);

    try {
      // Find all system admins
      const admins = await this.userRepository.find({
        where: [{ role: { name: 'Admin' } }, { role: { slug: 'admin' } }],
        relations: ['role'],
      });

      // Notify each admin
      for (const admin of admins) {
        await this.notificationsService.create({
          recipientId: admin.id,
          type: NotificationType.SYSTEM,
          translations: [
            {
              languageCode: Language.EN,
              title: 'New Problem Report',
              content:
                'A new problem report has been submitted regarding a problem.',
            },
            {
              languageCode: Language.VI,
              title: 'Báo cáo sự cố mới',
              content:
                'Một báo cáo sự cố mới đã được gửi liên quan đến một bài toán.',
            },
          ],
          metadata: {
            event: NotificationEvent.NEW_PROBLEM_REPORT,
            reportId: savedReport.id,
            problemId: createDto.problemId,
          },
        });
      }
    } catch (error) {
      console.error('Failed to notify admins about new problem report:', error);
    }

    return savedReport;
  }

  async findAll(
    page: number = 1,
    limit: number = 10,
    filter?: {
      status?: string;
      type?: string;
      search?: string;
      sortBy?: string;
      sortOrder?: 'ASC' | 'DESC';
    },
  ) {
    const queryBuilder = this.problemReportsRepository
      .createQueryBuilder('report')
      .leftJoinAndSelect('report.user', 'user')
      .leftJoinAndSelect('report.problem', 'problem');

    if (filter?.status) {
      queryBuilder.andWhere('report.status = :status', {
        status: filter.status,
      });
    }

    if (filter?.type) {
      queryBuilder.andWhere('report.type = :type', { type: filter.type });
    }

    if (filter?.search) {
      queryBuilder.andWhere(
        '(report.description ILIKE :search OR user.username ILIKE :search OR user.email ILIKE :search OR problem.title ILIKE :search)',
        { search: `%${filter.search}%` },
      );
    }

    const allowedSortFields = ['createdAt', 'updatedAt', 'status', 'type'];

    const sortField =
      filter?.sortBy && allowedSortFields.includes(filter.sortBy)
        ? `report.${filter.sortBy}`
        : 'report.createdAt';
    const sortOrder = filter?.sortOrder === 'ASC' ? 'ASC' : 'DESC';

    queryBuilder.orderBy(sortField, sortOrder);

    const [items, total] = await queryBuilder
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    const DEFAULT_AVATAR =
      'https://cdn.pixabay.com/photo/2018/11/13/21/43/avatar-3814049_1280.png';

    const itemsWithAvatar = items.map((report) => {
      if (report.user) {
        let avatarUrl = DEFAULT_AVATAR;
        if (report.user.avatarKey) {
          avatarUrl = this.storageService.getCloudFrontUrl(
            report.user.avatarKey,
          );
        }
        Object.assign(report.user, { avatarUrl });
      }
      return report;
    });

    return {
      data: itemsWithAvatar,
      meta: {
        totalItems: total,
        itemCount: items.length,
        itemsPerPage: limit,
        totalPages: Math.ceil(total / limit),
        currentPage: page,
      },
    };
  }

  async findOne(id: string) {
    const report = await this.problemReportsRepository.findOne({
      where: { id },
      relations: ['user', 'problem'],
    });

    if (!report) {
      throw new NotFoundException(`Problem report with ID ${id} not found`);
    }

    if (report.user) {
      let avatarUrl =
        'https://cdn.pixabay.com/photo/2018/11/13/21/43/avatar-3814049_1280.png';
      if (report.user.avatarKey) {
        avatarUrl = this.storageService.getCloudFrontUrl(report.user.avatarKey);
      }
      Object.assign(report.user, { avatarUrl });
    }

    return report;
  }

  async updateStatus(id: string, updateDto: UpdateProblemReportDto) {
    const report = await this.findOne(id);
    report.status = updateDto.status;
    return this.problemReportsRepository.save(report);
  }
}
