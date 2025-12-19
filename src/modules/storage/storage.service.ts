import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { Progress, Upload } from '@aws-sdk/lib-storage';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AwsConfig } from 'src/config';
import { Readable } from 'stream';

export interface UploadProgress {
  loaded: number;
  total?: number;
  percent: number;
}

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly s3Client: S3Client;
  private readonly awsConfig: AwsConfig;

  constructor(private readonly configService: ConfigService) {
    this.awsConfig = this.configService.getOrThrow<AwsConfig>('aws');

    this.s3Client = new S3Client({
      region: this.awsConfig.s3.region,
      credentials: {
        accessKeyId: this.awsConfig.accessKeyId,
        secretAccessKey: this.awsConfig.secretAccessKey,
      },
    });
  }

  /**
   * Upload a file to S3
   */
  async uploadFile(
    key: string,
    body: Buffer | Readable | string,
    contentType?: string,
  ): Promise<string> {
    try {
      const command = new PutObjectCommand({
        Bucket: this.awsConfig.s3.bucketName,
        Key: key,
        Body: body,
        ContentType: contentType || 'application/octet-stream',
      });

      await this.s3Client.send(command);

      // Return the S3 URL
      return `https://${this.awsConfig.s3.bucketName}.s3.${this.awsConfig.s3.region}.amazonaws.com/${key}`;
    } catch (error) {
      this.logger.error(`Failed to upload file ${key}:`, error);
      throw new Error(`Failed to upload file: ${(error as Error).message}`);
    }
  }

  /**
   * Upload a stream to S3 with progress tracking (for large files)
   */
  async uploadStream(
    key: string,
    stream: Readable,
    contentType: string = 'application/x-ndjson',
    onProgress?: (progress: UploadProgress) => void,
  ): Promise<{ location: string }> {
    const bucketName = this.awsConfig.s3.bucketName;
    this.logger.log(`Starting upload to s3://${bucketName}/${key}`);

    const upload = new Upload({
      client: this.s3Client,
      params: {
        Bucket: bucketName,
        Key: key,
        Body: stream,
        ContentType: contentType,
      },
      partSize: 10 * 1024 * 1024, // 10MB parts
      queueSize: 4, // Upload 4 parts in parallel
    });

    // Track progress
    upload.on('httpUploadProgress', (progress: Progress) => {
      const percent =
        progress.total && progress.loaded
          ? Math.round((progress.loaded / progress.total) * 100)
          : 0;

      this.logger.debug(
        `Upload progress: ${percent}% (${progress.loaded}/${progress.total || '?'} bytes)`,
      );

      if (onProgress) {
        onProgress({
          loaded: progress.loaded ?? 0,
          total: progress.total,
          percent,
        });
      }
    });

    try {
      const result = await upload.done();

      this.logger.log(`Upload completed: ${result.Location ?? key}`);

      return {
        location: result.Location ?? this.getObjectUrl(key),
      };
    } catch (error) {
      this.logger.error(`Upload failed: ${(error as Error)?.message}`);
      throw error;
    }
  }

  /**
   * Construct S3 object URL from bucket and key
   */
  private getObjectUrl(key: string): string {
    return `https://${this.awsConfig.s3.bucketName}.s3.${this.awsConfig.s3.region}.amazonaws.com/${key}`;
  }

  /**
   * Download a file from S3
   */
  async downloadFile(key: string): Promise<Buffer> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.awsConfig.s3.bucketName,
        Key: key,
      });

      const response = await this.s3Client.send(command);

      // Convert stream to buffer
      const stream = response.Body as Readable;
      const chunks: Buffer[] = [];

      return new Promise((resolve, reject) => {
        stream.on('data', (chunk: Buffer) => chunks.push(chunk));
        stream.on('error', reject);
        stream.on('end', () => resolve(Buffer.concat(chunks)));
      });
    } catch (error) {
      this.logger.error(`Failed to download file ${key}:`, error);
      throw new Error(`Failed to download file: ${(error as Error).message}`);
    }
  }

  /**
   * Get file content as string
   */
  async getFileContent(key: string): Promise<string> {
    const buffer = await this.downloadFile(key);
    return buffer.toString('utf-8');
  }

  /**
   * Delete a file from S3
   */
  async deleteFile(key: string): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.awsConfig.s3.bucketName,
        Key: key,
      });

      await this.s3Client.send(command);
      this.logger.log(`File ${key} deleted successfully`);
    } catch (error) {
      this.logger.error(`Failed to delete file ${key}:`, error);
      throw new Error(`Failed to delete file: ${(error as Error).message}`);
    }
  }

  /**
   * Check if file exists in S3
   */
  async fileExists(key: string): Promise<boolean> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.awsConfig.s3.bucketName,
        Key: key,
      });

      await this.s3Client.send(command);
      return true;
    } catch (error) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      if (error?.name === 'NotFound') {
        return false;
      }
      throw error;
    }
  }

  /**
   * Get a readable stream from S3 (for streaming large files without loading into memory)
   * @param bucket - S3 bucket name
   * @param key - S3 object key
   */
  async getFileStream(bucket: string, key: string): Promise<Readable> {
    try {
      const command = new GetObjectCommand({
        Bucket: bucket,
        Key: key,
      });

      const response = await this.s3Client.send(command);

      // Return the stream directly without buffering
      return response.Body as Readable;
    } catch (error) {
      this.logger.error(`Failed to get stream for ${bucket}/${key}:`, error);
      throw new Error(`Failed to get file stream: ${(error as Error).message}`);
    }
  }

  /**
   * Generate a presigned URL for temporary file access
   */
  async getPresignedUrl(
    key: string,
    expiresIn: number = 3600,
  ): Promise<string> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.awsConfig.s3.bucketName,
        Key: key,
      });

      return await getSignedUrl(this.s3Client, command, { expiresIn });
    } catch (error) {
      this.logger.error(`Failed to generate presigned URL for ${key}:`, error);
      throw new Error(
        `Failed to generate presigned URL: ${(error as Error).message}`,
      );
    }
  }
}
