import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { StorageService } from 'src/modules/storage/storage.service';
import {
  encodeBase64,
  msToSeconds,
  TESTCASE_DESTINATION_FOLDER,
  TestcaseFormat,
} from '../../../common';
import { Judge0SubmissionPayload } from '../../judge0/interfaces';
import { Judge0Service } from '../../judge0/judge0.service';
import { Problem } from '../../problems/entities/problem.entity';
import { TestcaseTransformService } from '../../problems/services/testcase-transform.service';
import { CreateTestcaseDto } from '../dto/create-submission.dto';

/** Maximum number of testcases to process */
const MAX_TESTCASES = 1000;

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
    private readonly testcaseTransformService: TestcaseTransformService,
    private readonly configService: ConfigService,
    private readonly storageService: StorageService,
  ) {}

  /**
   * Build Judge0 payloads for submission (from problem testcase file)
   * Streams testcases from local file or S3 based on useAWS config
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

    const useAWS = this.configService.get<boolean>('submission.useAWS');

    let testcaseSource: string;
    try {
      testcaseSource = useAWS
        ? await this.storageService.getPresignedUrl(problem.testcaseFileKey)
        : `${TESTCASE_DESTINATION_FOLDER}/local.json`;
    } catch (error) {
      this.logger.error(
        `Failed to get testcase source for problem ${problem.id}:`,
        error,
      );
      throw new InternalServerErrorException(
        `${ERROR_MESSAGES.STREAM_FAILED}: Unable to access testcase file`,
      );
    }

    // Get NDJSON stream from testcase file
    let ndjsonStream: NodeJS.ReadableStream;
    try {
      ndjsonStream =
        await this.testcaseTransformService.createTransformStream(
          testcaseSource,
        );
    } catch (error) {
      this.logger.error(
        `Failed to create transform stream for problem ${problem.id}:`,
        error,
      );
      throw new InternalServerErrorException(
        `${ERROR_MESSAGES.STREAM_FAILED}: Unable to create stream`,
      );
    }

    // Parse NDJSON stream and build Judge0 payloads
    const items: Judge0SubmissionPayload[] = [];
    let lineNumber = 0;
    let hasError = false;

    return new Promise((resolve, reject) => {
      const handleError = (error: Error, context: string) => {
        if (hasError) return; // Prevent multiple rejections
        hasError = true;
        this.logger.error(
          `Stream error for submission ${submissionId} at ${context}:`,
          error,
        );
        if (
          'destroy' in ndjsonStream &&
          typeof ndjsonStream.destroy === 'function'
        ) {
          (ndjsonStream.destroy as () => void)();
        }
        reject(error);
      };

      ndjsonStream.on('data', (line: string) => {
        if (hasError) return;

        lineNumber++;

        // Check max testcase limit
        if (lineNumber > MAX_TESTCASES) {
          handleError(
            new Error(
              `${ERROR_MESSAGES.MAX_TESTCASES_EXCEEDED}: ${MAX_TESTCASES}`,
            ),
            `line ${lineNumber}`,
          );
          return;
        }

        try {
          // Skip empty lines
          const trimmedLine = line.trim();
          if (!trimmedLine) return;

          const testcase = JSON.parse(trimmedLine) as TestcaseFormat;

          // Validate testcase structure
          if (typeof testcase !== 'object' || testcase === null) {
            throw new Error('Invalid testcase format: expected object');
          }

          const payload = this.buildPayload(
            sourceCode,
            judge0LanguageId,
            problem,
            submissionId,
            testcase.id ?? lineNumber - 1,
            testcase.input,
            testcase.output,
            true,
          );

          items.push(payload);
        } catch (error) {
          const errorMessage =
            error instanceof SyntaxError
              ? `Invalid JSON at line ${lineNumber}`
              : error instanceof Error
                ? error.message
                : 'Unknown error';

          handleError(
            new Error(`${ERROR_MESSAGES.PARSE_FAILED}: ${errorMessage}`),
            `line ${lineNumber}`,
          );
        }
      });

      ndjsonStream.on('end', () => {
        if (hasError) return;

        this.logger.debug(
          `Built ${items.length} payloads for submission ${submissionId}`,
        );
        resolve(items);
      });

      ndjsonStream.on('error', (error: Error) => {
        handleError(
          new Error(`${ERROR_MESSAGES.STREAM_FAILED}: ${error.message}`),
          'stream',
        );
      });
    });
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
