import { createReadStream } from 'node:fs';
import { Readable, Transform } from 'node:stream';

import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import {
  TESTCASE_DESTINATION_FOLDER,
  TestcaseFormat,
} from '../../../common/constants';
import { StorageService } from '../../storage/storage.service';

/**
 * Service for reading and parsing NDJSON testcase files from S3 or local storage
 * Designed for streaming large testcase files without loading entire file into memory
 */
@Injectable()
export class TestcaseReaderService {
  private readonly logger = new Logger(TestcaseReaderService.name);

  constructor(
    private readonly storageService: StorageService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Read NDJSON testcases from S3 key and return as async generator
   * Memory efficient: processes line-by-line without loading entire file
   *
   * @param s3Key - S3 object key (e.g., "testcases/problem-123.ndjson")
   * @returns AsyncGenerator yielding TestcaseFormat objects
   * @throws NotFoundException if file doesn't exist
   * @throws InternalServerErrorException if stream fails or parse error
   */
  async *readTestcases(
    s3Key: string,
  ): AsyncGenerator<TestcaseFormat, void, unknown> {
    this.logger.log(`Reading NDJSON testcases from: ${s3Key}`);

    // Get input stream from S3 or local
    const inputStream = await this.getInputStream(s3Key);

    // Create line splitter
    const lineSplitter = this.createLineSplitter();

    // Pipe input through line splitter
    const lineStream = inputStream.pipe(lineSplitter);

    let lineNumber = 0;
    let processedCount = 0;

    try {
      for await (const line of lineStream) {
        lineNumber++;

        try {
          const testcase = this.parseTestcaseLine(line as string, lineNumber);

          if (testcase) {
            processedCount++;
            yield testcase;

            // Progress logging
            if (processedCount % 100 === 0) {
              this.logger.debug(`Processed ${processedCount} testcases...`);
            }
          }
        } catch (parseError) {
          const message =
            parseError instanceof Error
              ? parseError.message
              : String(parseError);
          this.logger.error(
            `Failed to parse testcase at line ${lineNumber}: ${message}`,
          );
          throw new InternalServerErrorException(
            `Invalid testcase format at line ${lineNumber}`,
          );
        }
      }

      this.logger.log(`Completed reading ${processedCount} testcases`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Stream error while reading testcases: ${message}`);

      // Destroy stream on error
      if (!inputStream.destroyed) {
        inputStream.destroy();
      }

      // Re-throw if it's already an HTTP exception
      if (
        error instanceof NotFoundException ||
        error instanceof InternalServerErrorException
      ) {
        throw error;
      }

      throw new InternalServerErrorException(
        `Failed to read testcases: ${message}`,
      );
    }
  }

  /**
   * Get input stream from S3 or local file based on config
   *
   * @param s3Key - S3 object key
   * @returns NodeJS.ReadableStream
   * @private
   */
  private async getInputStream(s3Key: string): Promise<Readable> {
    const useAWS = this.configService.get<boolean>('submission.useAWS');

    if (useAWS) {
      this.logger.debug(`Fetching NDJSON stream from S3: ${s3Key}`);

      // Get S3 bucket from config
      const bucketName =
        this.configService.getOrThrow<string>('aws.s3.bucketName');

      try {
        // Use StorageService to get stream (already handles errors)
        return await this.storageService.getFileStream(bucketName, s3Key);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(`Failed to get S3 stream for ${s3Key}: ${message}`);
        throw new NotFoundException(`Testcase file not found: ${s3Key}`);
      }
    } else {
      // Local file mode
      const localPath = `${TESTCASE_DESTINATION_FOLDER}/local.ndjson`;
      this.logger.debug(`Reading NDJSON from local file: ${localPath}`);

      try {
        return createReadStream(localPath, { encoding: 'utf-8' });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(`Failed to read local file ${localPath}: ${message}`);
        throw new NotFoundException(`Testcase file not found: ${localPath}`);
      }
    }
  }

  /**
   * Create line-splitting transform stream for NDJSON
   * Handles partial lines, empty lines, and buffer management
   *
   * @returns Transform stream that emits complete lines
   * @private
   */
  private createLineSplitter(): Transform {
    let buffer = '';

    return new Transform({
      objectMode: false,
      readableObjectMode: true, // Output: line strings

      transform(
        chunk: Buffer,
        _encoding: string,
        callback: (error?: Error | null, data?: any) => void,
      ) {
        buffer += chunk.toString('utf-8');
        const lines = buffer.split('\n');

        // Keep last incomplete line in buffer
        buffer = lines.pop() || '';

        // Emit complete lines
        for (const line of lines) {
          if (line.trim()) {
            // Skip empty lines
            this.push(line);
          }
        }

        callback();
      },

      flush(callback: (error?: Error | null) => void) {
        // Emit any remaining buffered content
        if (buffer.trim()) {
          this.push(buffer);
        }
        callback();
      },
    });
  }

  /**
   * Parse NDJSON line to TestcaseFormat object
   *
   * @param line - Raw NDJSON line
   * @param lineNumber - Line number (for error reporting)
   * @returns Parsed TestcaseFormat object or null if empty/invalid
   * @throws Error if JSON parsing fails
   * @private
   */
  private parseTestcaseLine(
    line: string,
    lineNumber: number,
  ): TestcaseFormat | null {
    const trimmedLine = line.trim();

    // Skip empty lines
    if (!trimmedLine) {
      return null;
    }

    try {
      const parsed: unknown = JSON.parse(trimmedLine);

      // Validate structure
      if (typeof parsed !== 'object' || parsed === null) {
        throw new Error('Expected JSON object');
      }

      // Type guard: ensure parsed is a record with string properties
      const testcaseData = parsed as Record<string, unknown>;

      if (
        typeof testcaseData.input !== 'string' ||
        typeof testcaseData.output !== 'string'
      ) {
        throw new Error('Missing required fields: input, output');
      }

      return {
        id: typeof testcaseData.id === 'number' ? testcaseData.id : lineNumber,
        input: testcaseData.input,
        output: testcaseData.output,
      };
    } catch (error) {
      const message =
        error instanceof SyntaxError
          ? 'Invalid JSON syntax'
          : error instanceof Error
            ? error.message
            : 'Unknown error';

      throw new Error(`Line ${lineNumber}: ${message}`);
    }
  }
}
