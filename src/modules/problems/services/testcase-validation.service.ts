import { createReadStream } from 'node:fs';

import { BadRequestException, Injectable, Logger } from '@nestjs/common';

import { chain } from 'stream-chain';
import { parser } from 'stream-json';
import { streamArray } from 'stream-json/streamers/StreamArray';
import stripBomStream from 'strip-bom-stream';

import { TestcaseFormat } from '../../../common/constants';

/**
 * @description Result of testcase validation
 */
export interface ValidationResult {
  isValid: boolean;
  testcaseCount: number;
  errors: ValidationError[];
  warnings?: string[];
}

/**
 * @description Detail of a testcase validation error
 */
export interface ValidationError {
  testcaseIndex: number;
  field: string;
  message: string;
}

@Injectable()
export class TestcaseValidationService {
  private readonly logger = new Logger(TestcaseValidationService.name);

  private readonly MAX_TESTCASES = 10000;
  private readonly MAX_INPUT_SIZE = 10 * 1024 * 1024; // 10MB
  private readonly MAX_OUTPUT_SIZE = 10 * 1024 * 1024; // 10MB
  private readonly MAX_ERRORS = 50; // Stop after 50 errors

  /**
   *
   * @description Validate testcase JSON file
   * @param filePath Path to the testcase JSON file
   * @returns ValidationResult object with details of validation
   */
  async validateTestcaseFile(filePath: string): Promise<ValidationResult> {
    this.logger.log(`Starting validation for file: ${filePath}`);

    return new Promise((resolve, reject) => {
      let testcaseCount = 0;
      const errors: ValidationError[] = [];
      const warnings: string[] = [];
      let shouldAbort = false;

      const pipeline = chain([
        createReadStream(filePath),
        stripBomStream(),
        parser(),
        streamArray(),
      ]);

      pipeline
        .on('data', (data: { key: number; value: TestcaseFormat }) => {
          // Check if should stop early
          if (shouldAbort) {
            return;
          }

          const testcase = data.value;
          testcaseCount++;

          // Validate testcase structure and content
          this.validateTestcase(testcase, testcaseCount, errors, warnings);

          // Stop if too many errors
          if (errors.length >= this.MAX_ERRORS) {
            this.logger.warn(
              `Stopping validation: too many errors (${errors.length})`,
            );
            shouldAbort = true;
            pipeline.destroy();
            resolve({
              isValid: false,
              testcaseCount,
              errors,
              warnings,
            });
            return;
          }

          // Stop if too many testcases
          if (testcaseCount > this.MAX_TESTCASES) {
            errors.push({
              testcaseIndex: testcaseCount,
              field: 'count',
              message: `Too many testcases (maximum: ${this.MAX_TESTCASES})`,
            });
            shouldAbort = true;
            pipeline.destroy();
            resolve({
              isValid: false,
              testcaseCount,
              errors,
              warnings,
            });
            return;
          }

          // Log progress every 100 testcases
          if (testcaseCount % 100 === 0) {
            this.logger.debug(`Validated ${testcaseCount} testcases...`);
          }
        })
        .on('end', () => {
          if (shouldAbort) return;

          // Validation completed
          const isValid = errors.length === 0;

          this.logger.log(
            `Validation completed: ${testcaseCount} testcases, ` +
              `${errors.length} errors, ${warnings.length} warnings`,
          );

          resolve({
            isValid,
            testcaseCount,
            errors,
            warnings,
          });
        })
        .on('error', (error) => {
          if (shouldAbort) return;
          this.logger.error(`Validation stream error: ${error.message}`);

          // Parse JSON syntax errors
          if (error.message.includes('JSON')) {
            reject(
              new BadRequestException(`Invalid JSON format: ${error.message}`),
            );
          } else {
            reject(error);
          }
        });
    });
  }

  /**
   * @description Validate individual testcase
   * @param testcase Testcase object to validate
   * @param index Index of the testcase in the file
   * @param errors Errors array to collect validation errors
   * @param warnings Warnings array to collect validation warnings
   */
  private validateTestcase(
    testcase: TestcaseFormat,
    index: number,
    errors: ValidationError[],
    warnings: string[],
  ): void {
    // Required fields validation
    if (!testcase.input) {
      errors.push({
        testcaseIndex: index,
        field: 'input',
        message: 'Input is required',
      });
    } else if (typeof testcase.input !== 'string') {
      errors.push({
        testcaseIndex: index,
        field: 'input',
        message: 'Input must be a string',
      });
    } else if (testcase.input.trim() === '') {
      errors.push({
        testcaseIndex: index,
        field: 'input',
        message: 'Input cannot be empty',
      });
    } else if (testcase.input.length > this.MAX_INPUT_SIZE) {
      errors.push({
        testcaseIndex: index,
        field: 'input',
        message: `Input size exceeds ${this.MAX_INPUT_SIZE / 1024 / 1024}MB`,
      });
    }

    if (!testcase.output) {
      errors.push({
        testcaseIndex: index,
        field: 'output',
        message: 'Output is required',
      });
    } else if (typeof testcase.output !== 'string') {
      errors.push({
        testcaseIndex: index,
        field: 'output',
        message: 'Output must be a string',
      });
    } else if (testcase.output.trim() === '') {
      errors.push({
        testcaseIndex: index,
        field: 'output',
        message: 'Output cannot be empty',
      });
    } else if (testcase.output.length > this.MAX_OUTPUT_SIZE) {
      errors.push({
        testcaseIndex: index,
        field: 'output',
        message: `Output size exceeds ${this.MAX_OUTPUT_SIZE / 1024 / 1024}MB`,
      });
    }

    const allowedFields = ['input', 'output'];
    Object.keys(testcase).forEach((field) => {
      if (!allowedFields.includes(field)) {
        warnings.push(
          `Testcase ${index}: Unrecognized field '${field}' will be ignored`,
        );
      }
    });
  }

  /**
   * @description Format validation errors into a readable string
   * @param result ValidationResult object containing errors
   * @returns Formatted error string
   */
  formatValidationErrors(result: ValidationResult): string {
    const errorMessages = result.errors.map(
      (error) =>
        `Testcase ${error.testcaseIndex} (${error.field}): ${error.message}`,
    );

    return errorMessages.join('\n');
  }
}
