import { registerAs } from '@nestjs/config';

export interface AwsConfig {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  s3: {
    region: string;
    bucketName: string;
  };
  cloudFront: {
    url: string;
  };
}

export const awsConfig = registerAs(
  'aws',
  (): AwsConfig => ({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    region: process.env.AWS_REGION!,
    s3: {
      region: process.env.AWS_S3_REGION || process.env.AWS_REGION!,
      bucketName: process.env.AWS_S3_BUCKET!,
    },
    cloudFront: {
      url: process.env.AWS_CLOUDFRONT_URL!,
    },
  }),
);
