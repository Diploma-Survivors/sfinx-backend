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
import { HarnessInjectorService } from './harness-injector.service';
import { PackedProtocolService } from './packed-protocol.service';
import { TestcaseReaderService } from './testcase-reader.service';

/** Maximum number of testcases to process in a single submission */
const MAX_TESTCASES = 10_000;

/** Languages with slow JVM/compiler startup that need extra compile time (seconds) */
const SLOW_COMPILE_LANGUAGES = new Set(['kotlin', 'java', 'scala', 'groovy']);
const SLOW_COMPILE_TIMEOUT_SECONDS = 30;

/** Error messages */
const ERROR_MESSAGES = {
  NO_TESTCASE_FILE: 'Problem has no testcase file key',
  STREAM_FAILED: 'Failed to stream testcases',
  MAX_TESTCASES_EXCEEDED: 'Maximum testcase limit exceeded',
} as const;

export interface BuiltPayloads {
  /** Always contains exactly 1 Judge0 payload (all testcases combined) */
  payloads: Judge0SubmissionPayload[];
  /** Actual number of testcases packed into the single payload */
  testcaseCount: number;
}

/**
 * Service responsible for building Judge0 submission payloads.
 *
 * New architecture: ALL testcases are packed into a SINGLE Judge0 submission
 * using the prefixed-length protocol. The harness code (stored per language)
 * is injected with user code and handles per-testcase I/O redirection.
 */
@Injectable()
export class Judge0PayloadBuilderService {
  private readonly logger = new Logger(Judge0PayloadBuilderService.name);

  constructor(
    private readonly judge0Service: Judge0Service,
    private readonly testcaseReaderService: TestcaseReaderService,
    private readonly packedProtocol: PackedProtocolService,
    private readonly harnessInjector: HarnessInjectorService,
  ) {}

  /**
   * Build a single Judge0 payload for a full submission (from problem testcase file).
   * Streams all testcases, packs them, and injects user code into the harness.
   */
  async buildPayloadsForSubmit(
    submissionId: string,
    sourceCode: string,
    judge0LanguageId: number,
    problem: Problem,
    harnessCode: string | null,
    languageSlug: string,
  ): Promise<BuiltPayloads> {
    if (!problem.testcaseFileKey) {
      throw new NotFoundException(ERROR_MESSAGES.NO_TESTCASE_FILE);
    }

    const testcases: Array<{ input: string; expectedOutput: string }> = [];

    try {
      for await (const tc of this.testcaseReaderService.readTestcases(
        problem.testcaseFileKey,
      )) {
        if (testcases.length >= MAX_TESTCASES) {
          throw new Error(
            `${ERROR_MESSAGES.MAX_TESTCASES_EXCEEDED}: ${MAX_TESTCASES}`,
          );
        }
        testcases.push({ input: tc.input, expectedOutput: tc.output });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to stream testcases for submission ${submissionId}: ${message}`,
      );
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

    this.logger.debug(
      `Packed ${testcases.length} testcases into single payload for ${submissionId}`,
    );

    const payload = this.buildSinglePayload(
      sourceCode,
      judge0LanguageId,
      problem,
      submissionId,
      testcases,
      harnessCode,
      languageSlug,
      true,
    );

    return { payloads: [payload], testcaseCount: testcases.length };
  }

  /**
   * Build a single Judge0 payload for a test run (from DTO testcases).
   */
  buildPayloadsForTest(
    submissionId: string,
    sourceCode: string,
    judge0LanguageId: number,
    problem: Problem,
    testCases: CreateTestcaseDto[],
    harnessCode: string | null,
    languageSlug: string,
  ): BuiltPayloads {
    const testcases = testCases.map((tc) => ({
      input: tc.input,
      // Use NO_CHECK sentinel when no expected output is provided
      expectedOutput: tc.output?.trim()
        ? tc.output
        : PackedProtocolService.NO_CHECK_SENTINEL,
    }));

    const payload = this.buildSinglePayload(
      sourceCode,
      judge0LanguageId,
      problem,
      submissionId,
      testcases,
      harnessCode,
      languageSlug,
      false,
    );

    return { payloads: [payload], testcaseCount: testcases.length };
  }

  private buildSinglePayload(
    sourceCode: string,
    judge0LanguageId: number,
    problem: Problem,
    submissionId: string,
    testcases: Array<{ input: string; expectedOutput: string }>,
    harnessCode: string | null,
    languageSlug: string,
    isSubmit: boolean,
  ): Judge0SubmissionPayload {
    const injectedCode = this.harnessInjector.inject(
      harnessCode,
      sourceCode,
      languageSlug,
    );

    const packedStdinBase64 = this.packedProtocol.encodeStdinBase64(testcases);

    return {
      language_id: judge0LanguageId,
      source_code: encodeBase64(injectedCode),
      stdin: packedStdinBase64,
      // No expected_output — harness handles comparison internally
      redirect_stderr_to_stdout: false,
      cpu_time_limit: msToSeconds(problem.timeLimitMs),
      ...(SLOW_COMPILE_LANGUAGES.has(languageSlug) && {
        compile_timeout: SLOW_COMPILE_TIMEOUT_SECONDS,
      }),
      memory_limit: problem.memoryLimitKb,
      callback_url: this.judge0Service.getCallbackUrl(
        submissionId,
        '0', // always index 0 — one submission for all testcases
        isSubmit,
      ),
    };
  }
}
