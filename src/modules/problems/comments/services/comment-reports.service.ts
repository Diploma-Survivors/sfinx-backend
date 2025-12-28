import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Transactional } from 'typeorm-transactional';
import { PaginatedResultDto, SortOrder } from '../../../../common';
import { FilterCommentReportDto, ReportCommentDto } from '../dto';
import { Comment, CommentReport } from '../entities';

@Injectable()
export class CommentReportsService {
  constructor(
    @InjectRepository(CommentReport)
    private readonly reportRepository: Repository<CommentReport>,
    @InjectRepository(Comment)
    private readonly commentRepository: Repository<Comment>,
  ) {}

  /**
   * Report a comment as inappropriate
   */
  @Transactional()
  async reportComment(
    commentId: number,
    userId: number,
    dto: ReportCommentDto,
  ): Promise<void> {
    // Verify comment exists
    const comment = await this.commentRepository.findOne({
      where: { id: commentId },
    });

    if (!comment) {
      throw new NotFoundException(`Comment with ID ${commentId} not found`);
    }

    // Check if user already reported this comment
    const existingReport = await this.reportRepository.findOne({
      where: { commentId, userId },
    });

    if (existingReport) {
      throw new ConflictException('You have already reported this comment');
    }

    // Create report
    await this.reportRepository.save({
      commentId,
      userId,
      reason: dto.reason,
      description: dto.description,
    });

    // Increment report count on comment
    await this.commentRepository
      .createQueryBuilder()
      .update(Comment)
      .set({
        reportCount: () => 'report_count + 1',
      })
      .where('id = :id', { id: commentId })
      .execute();
  }

  /**
   * Get paginated reports for admin moderation
   */
  async getReports(
    query: FilterCommentReportDto,
  ): Promise<PaginatedResultDto<CommentReport>> {
    const { skip, take, sortBy, sortOrder, isResolved } = query;

    const queryBuilder = this.reportRepository
      .createQueryBuilder('report')
      .leftJoinAndSelect('report.comment', 'comment')
      .leftJoinAndSelect('report.reporter', 'reporter')
      .leftJoinAndSelect('report.resolver', 'resolver');

    // Filter by resolution status if provided
    if (isResolved !== undefined) {
      queryBuilder.andWhere('report.isResolved = :isResolved', { isResolved });
    }

    // Sorting with specific fields
    if (sortBy) {
      queryBuilder.orderBy(`report.${sortBy}`, sortOrder || SortOrder.DESC);
    } else {
      // Default sorting: unresolved first, then by creation date
      queryBuilder
        .orderBy('report.isResolved', SortOrder.ASC)
        .addOrderBy('report.createdAt', SortOrder.DESC);
    }

    queryBuilder.skip(skip).take(take);

    const [reports, total] = await queryBuilder.getManyAndCount();

    return new PaginatedResultDto(reports, {
      page: query.page ?? 1,
      limit: query.limit ?? 20,
      total,
    });
  }

  /**
   * Resolve a report (mark as reviewed)
   */
  @Transactional()
  async resolveReport(reportId: number, adminId: number): Promise<void> {
    const report = await this.reportRepository.findOne({
      where: { id: reportId },
    });

    if (!report) {
      throw new NotFoundException(`Report with ID ${reportId} not found`);
    }

    if (report.isResolved) {
      throw new ConflictException('Report is already resolved');
    }

    // Mark as resolved
    report.isResolved = true;
    report.resolvedAt = new Date();
    report.resolvedBy = adminId;

    await this.reportRepository.save(report);
  }

  /**
   * Get report by ID
   */
  async getReportById(id: number): Promise<CommentReport> {
    const report = await this.reportRepository.findOne({
      where: { id },
      relations: ['comment', 'reporter', 'resolver'],
    });

    if (!report) {
      throw new NotFoundException(`Report with ID ${id} not found`);
    }

    return report;
  }

  /**
   * Get all reports for a specific comment
   */
  async getReportsByComment(commentId: number): Promise<CommentReport[]> {
    return this.reportRepository.find({
      where: { commentId },
      relations: ['reporter', 'resolver'],
      order: { createdAt: SortOrder.DESC },
    });
  }
}
