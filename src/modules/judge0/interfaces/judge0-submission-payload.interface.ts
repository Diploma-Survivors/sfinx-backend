/**
 * @description Submission payload structure for Judge0 API
 * @see https://ce.judge0.com/#submissions
 */
export interface Judge0SubmissionPayload {
  language_id: number;
  source_code?: string;
  stdin?: string;
  expected_output?: string;
  additional_files?: string;
  cpu_time_limit?: number;
  memory_limit?: number;
  redirect_stderr_to_stdout?: boolean;
  callback_url?: string;
}
