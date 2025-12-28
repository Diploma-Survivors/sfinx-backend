import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { decodeBase64 } from 'src/common';
import { Judge0Response } from '../../judge0/interfaces';
import { Judge0Service } from '../../judge0/judge0.service';
import { Problem } from '../../problems/entities/problem.entity';
import {
  SubmissionResultDto,
  TestResultDto,
} from '../dto/submission-result.dto';
import {
  judge0StatusMap,
  SubmissionStatus,
} from '../enums/submission-status.enum';
import { ResultDescriptionGeneratorService } from './result-description-generator.service';
import { SubmissionStatsCalculatorService } from './submission-stats-calculator.service';

/**
 * Service responsible for building submission results from Judge0 responses
 * Handles transformation and aggregation of test results
 */
@Injectable()
export class SubmissionResultBuilderService {
  private readonly logger = new Logger(SubmissionResultBuilderService.name);

  constructor(
    @InjectRepository(Problem)
    private readonly problemRepository: Repository<Problem>,
    private readonly judge0Service: Judge0Service,
    private readonly statsCalculator: SubmissionStatsCalculatorService,
    private readonly descriptionGenerator: ResultDescriptionGeneratorService,
  ) {}

  /**
   * Build a test result DTO from Judge0 response
   */
  buildTestResult(response: Judge0Response): TestResultDto {
    const stdout = decodeBase64(response.stdout);
    const stderr = decodeBase64(response.stderr);
    const expectedOutput = decodeBase64(response.expected_output);
    const stdin = decodeBase64(response.stdin);
    const compileOutput = decodeBase64(response.compile_output);

    return {
      stdout,
      time: response.time,
      memory: response.memory,
      status: judge0StatusMap[response.status.id],
      stderr,
      token: response.token,
      expectedOutput,
      stdin,
      compileOutput,
    };
  }

  /**
   * Aggregate test results from Redis hash
   */
  aggregateTestResults(results: Record<string, string>): TestResultDto[] {
    const count = Object.keys(results).length;
    this.logger.debug(`Aggregating ${count} test results from Redis`);

    return Object.values(results).map((r) => {
      const testResult: Judge0Response = JSON.parse(r) as Judge0Response;
      return this.buildTestResult(testResult);
    });
  }

  /**
   * Build submission result for submit mode (full testcases)
   */
  async buildSubmissionResultForSubmitMode(
    testResults: TestResultDto[],
    problemId: number,
  ): Promise<SubmissionResultDto> {
    this.logger.log(
      `Building SUBMIT mode result for problem ${problemId} with ${testResults.length} test results`,
    );

    const problem = await this.findProblemOrFail(problemId);

    this.logger.debug(`Calculating submission statistics`);
    const stats = this.statsCalculator.calculateStats(testResults, problem);

    this.logger.debug(
      `Stats calculated - status: ${stats.overallStatus}, passed: ${stats.passedTests}/${stats.totalTests}`,
    );

    // If the first error is a Wrong Answer, fetch details to get stdin/expected_output
    if (
      stats.firstFailedTest &&
      stats.firstFailedTest.status === SubmissionStatus.WRONG_ANSWER
    ) {
      this.logger.log(
        `Wrong answer detected, fetching details for token: ${stats.firstFailedTest.token}`,
      );
      stats.firstFailedTest =
        await this.descriptionGenerator.enrichWrongAnswerDetails(
          stats.firstFailedTest,
        );
    }

    const score =
      stats.totalTests > 0
        ? Math.round((stats.passedTests / stats.totalTests) * 100)
        : 0;

    this.logger.log(
      `SUBMIT result built - status: ${stats.overallStatus}, score: ${score}%`,
    );

    return {
      status: stats.overallStatus,
      score,
      passedTests: stats.passedTests,
      totalTests: stats.totalTests,
      runtime: stats.sumRuntime > 0 ? stats.sumRuntime : undefined,
      memory: stats.sumMemory > 0 ? stats.sumMemory : undefined,
      resultDescription: this.descriptionGenerator.generate(
        stats.firstFailedTest,
      ),
    };
  }

  /**
   * Build submission result for run mode (with full test details)
   */
  async buildSubmissionResultForRunMode(
    testResults: TestResultDto[],
    problemId: number,
  ): Promise<SubmissionResultDto> {
    this.logger.log(
      `Building RUN mode result for problem ${problemId} with ${testResults.length} test results`,
    );

    const problem = await this.findProblemOrFail(problemId);

    const { overallStatus, passedTests, totalTests, sumRuntime, sumMemory } =
      this.statsCalculator.calculateStats(testResults, problem);
    const score = (passedTests * 100.0) / totalTests;

    this.logger.log(
      `RUN result built - status: ${overallStatus}, passed: ${passedTests}/${totalTests}`,
    );

    return {
      status: overallStatus,
      totalTests,
      passedTests,
      testResults,
      score: Math.round(score * 100) / 100, // Round to 2 decimal places
      runtime: sumRuntime,
      memory: sumMemory,
    };
  }

  /**
   * Find problem or throw error
   */
  private async findProblemOrFail(problemId: number): Promise<Problem> {
    const problem = await this.problemRepository.findOne({
      where: { id: problemId },
    });

    if (!problem) {
      throw new NotFoundException(`Problem ${problemId} not found`);
    }

    return problem;
  }
}
