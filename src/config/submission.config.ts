import { registerAs } from '@nestjs/config';

export interface SubmissionConfig {
  cleanupStreamTime: number;
  pingTime: number;
  job: {
    attempts: number;
    backoff: {
      type: 'exponential' | 'fixed';
      delay: number;
    };
    removeOnComplete: boolean;
    removeOnFail: number;
  };
  useAWS: boolean;
}

export const submissionConfig = registerAs(
  'submission',
  (): SubmissionConfig => ({
    cleanupStreamTime: Number.parseInt(
      process.env.SUBMISSION_CLEANUP_STREAM_TIME ?? '60000',
      10,
    ),
    pingTime: Number.parseInt(process.env.SUBMISSION_PING_TIME ?? '3000', 10),
    job: {
      attempts: Number.parseInt(process.env.JOB_ATTEMPTS ?? '5', 10),
      backoff: {
        type: (process.env.JOB_BACKOFF_TYPE ?? 'exponential') as
          | 'exponential'
          | 'fixed',
        delay: Number.parseInt(process.env.JOB_BACKOFF_DELAY ?? '1000', 10),
      },
      removeOnComplete: process.env.JOB_REMOVE_ON_COMPLETE === 'true',
      removeOnFail: Number.parseInt(process.env.JOB_REMOVE_ON_FAIL ?? '50', 10),
    },
    useAWS: process.env.USE_AWS === 'true',
  }),
);
