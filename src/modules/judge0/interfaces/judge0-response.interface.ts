import { Judge0Status } from './judge0-status.interface';

/**
 * @description Response structure from Judge0 API after submission
 * @see https://ce.judge0.com/#submissions-submission-get
 */
export interface Judge0Response {
  token: string;
  stdout?: string;
  time: number;
  memory: number;
  stderr?: string;
  compile_output?: string; // Compiler output after compilation, eg: errors, warnings, etc.
  message?: string;
  status: Judge0Status;
  expected_output?: string; // NOTE: This field is only returned in the GET request not in the callback
  stdin?: string; // NOTE: This field is only returned in the GET request not in the callback
}
