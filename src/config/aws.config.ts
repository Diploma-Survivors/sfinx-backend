import { registerAs } from '@nestjs/config';

export interface AwsConfig {
  accessKeyId: string;
  secretAccessKey: string;
  s3: {
    region: string;
    bucketName: string;
  };
}

export const awsConfig = registerAs(
  'aws',
  (): AwsConfig => ({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    s3: {
      region: process.env.AWS_S3_REGION!,
      bucketName: process.env.AWS_S3_BUCKET!,
    },
  }),
);
