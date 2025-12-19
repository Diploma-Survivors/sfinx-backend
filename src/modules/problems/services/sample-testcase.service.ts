import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { CreateSampleTestcaseDto } from '../dto/create-sample-testcase.dto';
import { Problem } from '../entities/problem.entity';
import { SampleTestcase } from '../entities/sample-testcase.entity';

/**
 * Service responsible for managing sample testcases
 * Follows Single Responsibility Principle
 */
@Injectable()
export class SampleTestcaseService {
  constructor(
    @InjectRepository(SampleTestcase)
    private readonly sampleTestcaseRepository: Repository<SampleTestcase>,
    @InjectRepository(Problem)
    private readonly problemRepository: Repository<Problem>,
  ) {}

  /**
   * Create a sample testcase
   */
  async createSampleTestcase(
    createSampleDto: CreateSampleTestcaseDto,
  ): Promise<SampleTestcase> {
    const { problemId, ...sampleData } = createSampleDto;

    // Verify problem exists
    const problem = await this.getProblem(problemId);

    const sample = this.sampleTestcaseRepository.create({
      ...sampleData,
      problem,
    });

    return this.sampleTestcaseRepository.save(sample);
  }

  /**
   * Get all sample testcases for a problem
   */
  async getSampleTestcases(problemId: number): Promise<SampleTestcase[]> {
    return this.sampleTestcaseRepository.find({
      where: { problem: { id: problemId } },
      order: { orderIndex: 'ASC' },
    });
  }

  /**
   * Update sample testcase
   */
  async updateSampleTestcase(
    id: number,
    updateData: Partial<SampleTestcase>,
  ): Promise<SampleTestcase> {
    const sample = await this.sampleTestcaseRepository.findOne({
      where: { id },
    });

    if (!sample) {
      throw new NotFoundException(`Sample testcase with ID ${id} not found`);
    }

    Object.assign(sample, updateData);
    return this.sampleTestcaseRepository.save(sample);
  }

  /**
   * Delete sample testcase
   */
  async deleteSampleTestcase(id: number): Promise<void> {
    const sample = await this.sampleTestcaseRepository.findOne({
      where: { id },
    });

    if (!sample) {
      throw new NotFoundException(`Sample testcase with ID ${id} not found`);
    }

    await this.sampleTestcaseRepository.remove(sample);
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
