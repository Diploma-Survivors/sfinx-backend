import { createReadStream } from 'node:fs';
import { Readable, Transform } from 'node:stream';

import { Injectable, Logger } from '@nestjs/common';

import { chain } from 'stream-chain';
import { parser } from 'stream-json';
import { streamArray } from 'stream-json/streamers/StreamArray';
import stripBomStream from 'strip-bom-stream';

import { TestcaseFormat } from '../../../common/constants';
import { StorageService } from '../../storage/storage.service';

/**
 * Dedicated Transform stream class for converting JSON testcases to NDJSON format
 */
class TestcaseNDJSONTransform extends Transform {
  private testcaseId = 0;
  private processedCount = 0;

  constructor(private readonly logger: Logger) {
    super({
      objectMode: true, // Input: objects from stream-json
      writableObjectMode: true,
      readableObjectMode: false, // Output: strings (NDJSON lines)
    });
  }

  _transform(
    data: { key: number; value: TestcaseFormat },
    _encoding: string,
    callback: (error?: Error | null, data?: any) => void,
  ): void {
    try {
      const testcase = data.value;
      this.testcaseId++;

      // Build NDJSON object
      const ndjsonObject: any = {
        id: this.testcaseId,
        input: testcase.input,
        output: testcase.output,
      };

      // Convert to NDJSON line (JSON + newline)
      const ndjsonLine = JSON.stringify(ndjsonObject) + '\n';

      this.processedCount++;
      if (this.processedCount % 100 === 0) {
        this.logger.debug(`Transformed ${this.processedCount} testcases...`);
      }

      callback(null, ndjsonLine);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Transform error at testcase ${this.testcaseId}: ${message}`,
      );
      callback(error as unknown as Error);
    }
  }

  _flush(callback: (error?: Error | null) => void): void {
    this.logger.log(`Transform completed: ${this.processedCount} testcases`);
    callback();
  }
}

@Injectable()
export class TestcaseTransformService {
  private readonly logger = new Logger(TestcaseTransformService.name);

  constructor(private readonly storageService: StorageService) {}

  /**
   * Create a transform stream that reads a JSON testcase file from local or S3
   * and outputs NDJSON formatted testcases (streams chunk by chunk, no full file in memory)
   *
   * @param source - Local file path or S3 URL (s3://bucket/key or https://...)
   * @returns Readable stream of NDJSON testcases
   */
  async createTransformStream(source: string): Promise<Readable> {
    this.logger.log(`Creating transform stream for: ${source}`);

    // Get input stream (either from local file or S3)
    const inputStream = await this.getInputStream(source);

    // Pipeline: Input Stream → Strip BOM → Parse JSON Array → Stream Array → Transform to NDJSON
    const pipeline = chain([
      inputStream,
      stripBomStream(),
      parser(),
      streamArray(),
      new TestcaseNDJSONTransform(this.logger),
    ]);

    pipeline.on('error', (err) => {
      this.logger.error(`Transform pipeline error: ${err.message}`);
    });

    return pipeline;
  }

  /**
   * Get input stream from either local file or S3 (streaming, no buffering)
   */
  private async getInputStream(source: string): Promise<Readable> {
    // Check if source is an S3 URL
    if (this.isS3Url(source)) {
      this.logger.log(`Streaming from S3: ${source}`);
      return this.getS3Stream(source);
    }

    // Otherwise, treat as local file path
    this.logger.log(`Streaming from local file: ${source}`);
    return createReadStream(source);
  }

  /**
   * Check if source is an S3 URL
   */
  private isS3Url(source: string): boolean {
    return (
      source.startsWith('s3://') ||
      (source.startsWith('https://') && source.includes('.s3.')) ||
      source.startsWith('https://s3.')
    );
  }

  /**
   * Get readable stream from S3 (streams directly, no buffering)
   */
  private async getS3Stream(s3Url: string): Promise<Readable> {
    try {
      const { bucket, key } = this.parseS3Url(s3Url);

      // Use StorageService to get S3 stream directly (no buffering)
      return await this.storageService.getFileStream(bucket, key);
    } catch (error) {
      this.logger.error(
        `Failed to get S3 stream: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }

  /**
   * Parse S3 URL to extract bucket and key
   */
  private parseS3Url(s3Url: string): { bucket: string; key: string } {
    try {
      if (s3Url.startsWith('s3://')) {
        // Format: s3://bucket/key/path
        const withoutProtocol = s3Url.substring(5);
        const firstSlash = withoutProtocol.indexOf('/');
        const bucket = withoutProtocol.substring(0, firstSlash);
        const key = withoutProtocol.substring(firstSlash + 1);
        return { bucket, key };
      } else {
        // Format: https://bucket.s3.region.amazonaws.com/key/path
        const url = new URL(s3Url);
        const bucket = url.hostname.split('.')[0];
        const key = url.pathname.substring(1); // Remove leading slash
        return { bucket, key };
      }
    } catch {
      throw new Error(`Invalid S3 URL format: ${s3Url}`);
    }
  }
}
