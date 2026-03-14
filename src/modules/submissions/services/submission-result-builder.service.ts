import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { decodeBase64 } from 'src/common';
import { Judge0Response } from '../../judge0/interfaces';
import { Problem } from '../../problems/entities/problem.entity';
import {
  SubmissionResultDto,
  TestResultDto,
} from '../dto/submission-result.dto';
import {
  judge0StatusMap,
  SubmissionStatus,
} from '../enums/submission-status.enum';
import {
  HarnessTestResult,
  PackedProtocolService,
} from './packed-protocol.service';
import { ResultDescriptionGeneratorService } from './result-description-generator.service';
import { SubmissionStatsCalculatorService } from './submission-stats-calculator.service';

/**
 * Service responsible for building submission results from Judge0 responses.
 *
 * With the batched harness architecture, each user submission maps to ONE
 * Judge0 submission. The harness outputs packed results (per-testcase
 * AC/WA/RE + timing) which we unpack here.
 */
@Injectable()
export class SubmissionResultBuilderService {
  private readonly logger = new Logger(SubmissionResultBuilderService.name);

  constructor(
    @InjectRepository(Problem)
    private readonly problemRepository: Repository<Problem>,
    private readonly packedProtocol: PackedProtocolService,
    private readonly statsCalculator: SubmissionStatsCalculatorService,
    private readonly descriptionGenerator: ResultDescriptionGeneratorService,
  ) {}

  /**
   * Convert a single Judge0Response (for the entire batch) into an array of
   * per-testcase TestResultDto:
   *   - CE / TLE / MLE: apply that status to all N testcases (harness never ran)
   *   - Accepted (status=3): decode harness packed stdout for per-testcase results
   *   - RE (7-12): try to decode partial harness output; remaining unprocessed
   *     testcases get RE with judge-level stderr
   */
  buildResultsFromHarnessResponse(
    response: Judge0Response,
    totalTestcases: number,
  ): TestResultDto[] {
    const submissionStatus =
      judge0StatusMap[response.status.id] ?? SubmissionStatus.UNKNOWN_ERROR;

    // CE and MLE: harness never ran, apply to all testcases
    if (
      submissionStatus === SubmissionStatus.COMPILATION_ERROR ||
      submissionStatus === SubmissionStatus.MEMORY_LIMIT_EXCEEDED
    ) {
      this.logger.debug(
        `Judge0 ${submissionStatus} (id=${response.status.id}) — applying to all ${totalTestcases} testcases`,
      );
      return Array.from({ length: totalTestcases }, () =>
        this.buildJudgeLevelResult(submissionStatus, response),
      );
    }

    // TLE: harness was killed, apply TLE to all testcases
    if (submissionStatus === SubmissionStatus.TIME_LIMIT_EXCEEDED) {
      this.logger.debug(
        `Judge0 TLE — applying to all ${totalTestcases} testcases`,
      );
      return Array.from({ length: totalTestcases }, () =>
        this.buildJudgeLevelResult(submissionStatus, response),
      );
    }

    // ACCEPTED or RE: try to parse harness output.
    // If Judge0 says ACCEPTED but harness output is unparseable (corrupted),
    // treat remaining testcases as WRONG_ANSWER — not as ACCEPTED.
    const fallbackStatus =
      submissionStatus === SubmissionStatus.ACCEPTED
        ? SubmissionStatus.WRONG_ANSWER
        : submissionStatus;
    return this.decodeHarnessOutput(response, totalTestcases, fallbackStatus);
  }

  /**
   * Build submission result for submit mode (full testcases).
   * totalTestcases must come from Redis meta — correct denominator even when
   * harness stopped early (fail-fast).
   */
  async buildSubmissionResultForSubmitMode(
    testResults: TestResultDto[],
    problemId: number,
    totalTestcases: number,
  ): Promise<SubmissionResultDto> {
    this.logger.log(
      `Building SUBMIT mode result for problem ${problemId}, ${testResults.length} decoded / ${totalTestcases} total`,
    );

    const problem = await this.findProblemOrFail(problemId);
    const stats = this.statsCalculator.calculateStats(
      testResults,
      problem,
      totalTestcases,
    );

    this.logger.debug(
      `Stats: ${stats.overallStatus}, passed=${stats.passedTests}/${stats.totalTests}`,
    );

    const score =
      stats.totalTests > 0
        ? Math.round((stats.passedTests / stats.totalTests) * 100)
        : 0;

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
   * Build submission result for run mode (custom testcases, with full details).
   */
  async buildSubmissionResultForRunMode(
    testResults: TestResultDto[],
    problemId: number,
    totalTestcases: number,
  ): Promise<SubmissionResultDto> {
    this.logger.log(
      `Building RUN mode result for problem ${problemId}, ${testResults.length} decoded / ${totalTestcases} total`,
    );

    const problem = await this.findProblemOrFail(problemId);
    const { overallStatus, passedTests, totalTests, sumRuntime, sumMemory } =
      this.statsCalculator.calculateStats(testResults, problem, totalTestcases);

    const score = totalTests > 0 ? (passedTests * 100.0) / totalTests : 0;

    return {
      status: overallStatus,
      totalTests,
      passedTests,
      testResults,
      score: Math.round(score * 100) / 100,
      runtime: sumRuntime,
      memory: sumMemory,
    };
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  /**
   * Try to decode harness packed stdout. Fill any remaining (unprocessed)
   * testcases with the judge-level status (RE for mid-execution crash).
   */
  private decodeHarnessOutput(
    response: Judge0Response,
    totalTestcases: number,
    judgeLevelStatus: SubmissionStatus,
  ): TestResultDto[] {
    const packedBase64 = response.stdout;
    let decoded: HarnessTestResult[] = [];

    if (packedBase64) {
      try {
        decoded = this.packedProtocol.decodeStdoutBase64(packedBase64);
        this.logger.debug(
          `Decoded ${decoded.length}/${totalTestcases} harness results`,
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.error(`Failed to decode harness stdout: ${msg}`);
        // decoded stays empty — all testcases will get judge-level status below
      }
    }

    const results: TestResultDto[] = decoded.map((r) =>
      this.mapHarnessResult(r, response),
    );

    // Fill remaining testcases (harness stopped early or crashed)
    const remaining = totalTestcases - decoded.length;
    if (remaining > 0) {
      this.logger.debug(
        `Filling ${remaining} unprocessed testcases with ${judgeLevelStatus}`,
      );
      const fallback = this.buildJudgeLevelResult(judgeLevelStatus, response);
      for (let i = 0; i < remaining; i++) {
        results.push({ ...fallback });
      }
    }

    return results;
  }

  /** Build a TestResultDto for a judge-level error (CE/TLE/MLE/RE/etc.) */
  private buildJudgeLevelResult(
    status: SubmissionStatus,
    response: Judge0Response,
  ): TestResultDto {
    const rawStderr = decodeBase64(response.stderr);
    const rawCompile = decodeBase64(response.compile_output);

    // For RE: if stderr is empty, fall back to Judge0's status description
    // (e.g. "Runtime Error (SIGSEGV)", "Runtime Error (NZEC)") so the user
    // gets a meaningful signal instead of a blank error.
    const stderr =
      rawStderr ||
      (status === SubmissionStatus.RUNTIME_ERROR
        ? (response.status.description ?? undefined)
        : undefined) ||
      response.message ||
      undefined;

    // Detect compile-time TLE: Judge0 still reports status 5 but description
    // says "Compile Time Limit Exceeded".
    const isCompileTLE =
      status === SubmissionStatus.TIME_LIMIT_EXCEEDED &&
      response.status.description?.toLowerCase().includes('compile');

    return {
      status,
      compileOutput:
        status === SubmissionStatus.COMPILATION_ERROR || isCompileTLE
          ? (rawCompile ?? rawStderr ?? undefined)
          : undefined,
      stderr: isCompileTLE
        ? `Compile time limit exceeded — the compiler took too long. This may happen with complex generics or template-heavy code.`
        : stderr,
      time: Number(response.time) || 0,
      memory: response.memory,
      stdout: '',
    };
  }

  /** Map a single HarnessTestResult to TestResultDto */
  private mapHarnessResult(
    r: HarnessTestResult,
    judge0: Judge0Response,
  ): TestResultDto {
    const status =
      r.status === 'AC'
        ? SubmissionStatus.ACCEPTED
        : r.status === 'WA'
          ? SubmissionStatus.WRONG_ANSWER
          : SubmissionStatus.RUNTIME_ERROR;

    return {
      status,
      stdout: r.stdout,
      stdin: r.input || undefined,
      expectedOutput: r.expected || undefined,
      time: r.timeMs / 1000,
      // memory is per-submission in Judge0 (not per-testcase)
      memory: judge0.memory,
    };
  }

  private async findProblemOrFail(problemId: number): Promise<Problem> {
    const problem = await this.problemRepository.findOne({
      where: { id: problemId },
    });
    if (!problem) throw new NotFoundException(`Problem ${problemId} not found`);
    return problem;
  }
}
