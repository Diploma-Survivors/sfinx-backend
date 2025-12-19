import { Injectable } from '@nestjs/common';
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

/**
 * Service responsible for building Judge0 submission payloads
 * Follows Single Responsibility Principle
 */
@Injectable()
export class Judge0PayloadBuilderService {
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
      throw new Error('Problem has no testcase file key');
    }

    const useAWS = this.configService.get<boolean>('submission.useAWS');
    const testcaseSource = useAWS
      ? await this.storageService.getPresignedUrl(problem.testcaseFileKey)
      : `${TESTCASE_DESTINATION_FOLDER}/local.json`; // Local path

    // Get NDJSON stream from testcase file
    const ndjsonStream =
      await this.testcaseTransformService.createTransformStream(testcaseSource);

    // Parse NDJSON stream and build Judge0 payloads
    const items: Judge0SubmissionPayload[] = [];

    return new Promise((resolve, reject) => {
      ndjsonStream.on('data', (line: string) => {
        try {
          const testcase = JSON.parse(line) as TestcaseFormat;

          const payload = this.buildPayload(
            sourceCode,
            judge0LanguageId,
            problem,
            submissionId,
            testcase.id ?? 0,
            testcase.input,
            testcase.output,
            true, // isSubmit = true
          );

          items.push(payload);
        } catch (error) {
          reject(
            new Error(
              `Failed to parse testcase: ${error instanceof Error ? error.message : 'Unknown error'}`,
            ),
          );
        }
      });

      ndjsonStream.on('end', () => {
        resolve(items);
      });

      ndjsonStream.on('error', (error) => {
        reject(new Error(`Failed to stream testcases: ${error.message}`));
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

  /**
   * Build a single Judge0 submission payload
   */
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
      source_code: sourceCode,
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
