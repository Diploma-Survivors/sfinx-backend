import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { unlink } from 'node:fs/promises';

import { StorageService } from 'src/modules/storage/storage.service';
import {
  TESTCASE_FILE_EXTENSION,
  TESTCASE_FILE_MIME_TYPE,
} from '../../../common';
import { Problem } from '../entities/problem.entity';
import { TestcaseTransformService } from './testcase-transform.service';
import { TestcaseValidationService } from './testcase-validation.service';

/**
 * Service responsible for managing testcase file operations
 * Follows Single Responsibility Principle
 */
@Injectable()
export class TestcaseFileService {
  private readonly logger = new Logger(TestcaseFileService.name);

  constructor(
    @InjectRepository(Problem)
    private readonly problemRepository: Repository<Problem>,
    private readonly storageService: StorageService,
    private readonly validationService: TestcaseValidationService,
    private readonly transformService: TestcaseTransformService,
  ) {}

  /**
   * Upload testcase file for a problem
   * @returns Object containing S3 key and testcase count
   */
  async uploadTestcaseFile(
    file: Express.Multer.File,
    problemId: number,
  ): Promise<{ key: string; testcaseCount: number }> {
    const problem = await this.getProblem(problemId);

    // Generate S3 key
    const key = `testcases/problem-${problemId}${TESTCASE_FILE_EXTENSION}`;

    try {
      const validationResult =
        await this.validationService.validateTestcaseFile(file.path);

      if (!validationResult.isValid) {
        const errorMessage =
          this.validationService.formatValidationErrors(validationResult);
        throw new BadRequestException({
          message: 'Testcase validation failed',
          errors: validationResult.errors,
          summary: errorMessage,
        });
      }

      if (validationResult.warnings && validationResult.warnings.length > 0) {
        this.logger.warn(
          `Validation warnings:\n${validationResult.warnings.join('\n')}`,
        );
      }

      const transformStream = await this.transformService.createTransformStream(
        file.path,
      );

      await this.storageService.uploadStream(
        key,
        transformStream,
        TESTCASE_FILE_MIME_TYPE,
        (progress) => {
          this.logger.debug(
            `Upload progress: ${progress.percent}% (${progress.loaded} bytes)`,
          );
        },
      );

      // Upload to S3 using StorageService
      await this.storageService.uploadFile(
        key,
        transformStream,
        TESTCASE_FILE_MIME_TYPE,
      );

      // Update problem with testcase info
      problem.testcaseFileKey = key;
      problem.testcaseCount = validationResult.testcaseCount;
      await this.problemRepository.save(problem);

      return {
        key,
        testcaseCount: validationResult.testcaseCount,
      };
    } catch (err) {
      this.logger.error(
        `Failed to upload testcase file: ${(err as Error)?.message}`,
      );
      throw err;
    } finally {
      await this.cleanupTempFile(file.path);
    }
  }

  /**
   * Clean up temporary file
   * @param filePath Path to temporary file
   */
  private async cleanupTempFile(filePath: string): Promise<void> {
    await unlink(filePath);
  }

  /**
   * Get presigned URL for testcase file download
   */
  async getTestcaseFileUrl(
    problemId: number,
    expiresIn: number = 3600,
  ): Promise<string> {
    const problem = await this.getProblem(problemId);

    if (!problem.testcaseFileKey) {
      throw new NotFoundException(`Problem #${problemId} has no testcase file`);
    }

    // Generate presigned URL for secure download
    return this.storageService.getPresignedUrl(
      problem.testcaseFileKey,
      expiresIn,
    );
  }

  /**
   * Get testcase file content from S3
   */
  async getTestcaseContent(problemId: number): Promise<string> {
    const problem = await this.getProblem(problemId);

    if (!problem.testcaseFileKey) {
      throw new NotFoundException(`Problem #${problemId} has no testcase file`);
    }

    // Download and get content using StorageService
    return this.storageService.getFileContent(problem.testcaseFileKey);
  }

  /**
   * Delete testcase file for a problem
   */
  async deleteTestcaseFile(problemId: number): Promise<void> {
    const problem = await this.getProblem(problemId);

    if (problem.testcaseFileKey) {
      // Delete from S3 using StorageService
      await this.storageService.deleteFile(problem.testcaseFileKey);

      problem.testcaseFileKey = null;
      problem.testcaseCount = 0;
      await this.problemRepository.save(problem);
    }
  }

  /**
   * Helper method to get problem by ID
   */
  private async getProblem(problemId: number): Promise<Problem> {
    const problem = await this.problemRepository.findOne({
      where: { id: problemId },
    });

    if (!problem) {
      throw new NotFoundException(`Problem with ID ${problemId} not found`);
    }

    return problem;
  }
}
