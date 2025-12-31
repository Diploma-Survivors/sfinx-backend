import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';

import { encodeBase64, msToSeconds } from '../../../common';
import { Judge0SubmissionPayload } from '../../judge0/interfaces';
import { Judge0Service } from '../../judge0/judge0.service';
import { Problem } from '../../problems/entities/problem.entity';
import { CreateTestcaseDto } from '../dto/create-submission.dto';

import { TestcaseReaderService } from './testcase-reader.service';

/** Maximum number of testcases to process */
const MAX_TESTCASES = 10000;

/** Error messages */
const ERROR_MESSAGES = {
  NO_TESTCASE_FILE: 'Problem has no testcase file key',
  STREAM_FAILED: 'Failed to stream testcases',
  PARSE_FAILED: 'Failed to parse testcase',
  MAX_TESTCASES_EXCEEDED: 'Maximum testcase limit exceeded',
} as const;

/**
 * Service responsible for building Judge0 submission payloads
 */
@Injectable()
export class Judge0PayloadBuilderService {
  private readonly logger = new Logger(Judge0PayloadBuilderService.name);

  constructor(
    private readonly judge0Service: Judge0Service,
    private readonly testcaseReaderService: TestcaseReaderService,
  ) {}

  /**
   * Build Judge0 payloads for submission (from problem testcase file)
   * Streams testcases from S3 or local file using TestcaseReaderService
   */
  async buildPayloadsForSubmit(
    submissionId: string,
    sourceCode: string,
    judge0LanguageId: number,
    problem: Problem,
  ): Promise<Judge0SubmissionPayload[]> {
    if (!problem.testcaseFileKey) {
      throw new NotFoundException(ERROR_MESSAGES.NO_TESTCASE_FILE);
    }

    const payloads: Judge0SubmissionPayload[] = [];
    let testcaseIndex = 0;

    try {
      // Use async generator to stream testcases from NDJSON file
      for await (const testcase of this.testcaseReaderService.readTestcases(
        problem.testcaseFileKey,
      )) {
        // Check max testcase limit
        if (testcaseIndex >= MAX_TESTCASES) {
          throw new Error(
            `${ERROR_MESSAGES.MAX_TESTCASES_EXCEEDED}: ${MAX_TESTCASES}`,
          );
        }

        // Build Judge0 payload for this testcase
        const payload = this.buildPayload(
          sourceCode,
          judge0LanguageId,
          problem,
          submissionId,
          testcase.id ?? testcaseIndex,
          testcase.input,
          testcase.output,
          true,
        );

        payloads.push(payload);
        testcaseIndex++;
      }

      this.logger.debug(
        `Built ${payloads.length} payloads for submission ${submissionId}`,
      );

      return payloads;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to build payloads for submission ${submissionId}: ${message}`,
      );

      // Re-throw if it's already an HTTP exception
      if (
        error instanceof NotFoundException ||
        error instanceof InternalServerErrorException
      ) {
        throw error;
      }

      throw new InternalServerErrorException(
        `${ERROR_MESSAGES.STREAM_FAILED}: ${message}`,
      );
    }
  }

  /**
   * Build Judge0 payloads for test run (from DTO testcases)
   */
  buildPayloadsForTest(
    submissionId: string,
    sourceCode: string,
    judge0LanguageId: number,
    problem: Problem,
    testCases: CreateTestcaseDto[],
  ): Judge0SubmissionPayload[] {
    return testCases.map((testCase, index) =>
      this.buildPayload(
        sourceCode,
        judge0LanguageId,
        problem,
        submissionId,
        index,
        testCase.input,
        testCase.output,
        false, // isSubmit = false
      ),
    );
  }

  private buildPayload(
    sourceCode: string,
    judge0LanguageId: number,
    problem: Problem,
    submissionId: string,
    index: number,
    stdinRaw: string | undefined,
    expectedOutput: string | undefined,
    isSubmit: boolean,
  ): Judge0SubmissionPayload {
    return {
      language_id: judge0LanguageId,
      source_code: encodeBase64(sourceCode),
      stdin: stdinRaw ? encodeBase64(stdinRaw) : undefined,
      expected_output: expectedOutput
        ? encodeBase64(expectedOutput)
        : undefined,
      redirect_stderr_to_stdout: true,
      cpu_time_limit: msToSeconds(problem.timeLimitMs),
      memory_limit: problem.memoryLimitKb,
      callback_url: this.judge0Service.getCallbackUrl(
        submissionId,
        String(index),
        isSubmit,
      ),
    };
  }
}
