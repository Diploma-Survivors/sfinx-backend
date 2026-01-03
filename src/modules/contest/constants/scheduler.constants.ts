export const CONTEST_QUEUE = 'contest-scheduler';

export const CONTEST_JOBS = {
  START: 'start-contest',
  END: 'end-contest',
};

export const BULL_EVENTS = {
  COMPLETED: 'completed',
  FAILED: 'failed',
} as const;

export const CONTEST_SCHEDULER_JOBS = {
  // Deprecated: Kept effectively for any legacy usage or cleanup, but prefer CONTEST_JOBS
  START_PREFIX: 'start_contest_',
  END_PREFIX: 'end_contest_',
};

// Start/End job IDs should be deterministic based on contest ID
export const getContestStartJobId = (contestId: number) =>
  `${CONTEST_JOBS.START}-${contestId}`;
export const getContestEndJobId = (contestId: number) =>
  `${CONTEST_JOBS.END}-${contestId}`;

export const getContestStartJobName = (contestId: number) =>
  `${CONTEST_SCHEDULER_JOBS.START_PREFIX}${contestId}`;

export const getContestEndJobName = (contestId: number) =>
  `${CONTEST_SCHEDULER_JOBS.END_PREFIX}${contestId}`;
