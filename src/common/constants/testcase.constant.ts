export const TESTCASE_FILE_EXTENSION = '.ndjson';
export const TESTCASE_FILE_UPLOAD_EXTENSION = '.json';
export const TESTCASE_MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB
export const TESTCASE_FILE_UPLOAD_MIME_TYPE = 'application/x-ndjson';
export const TESTCASE_FILE_MIME_TYPE = 'application/json';
export const TESTCASE_DESTINATION_FOLDER = 'src/temp/uploads/testcases';
export const TESTCASE_FILE_FIELD_NAME = 'testcaseFile';

/**
 * @description Structure of a testcase
 */
export interface TestcaseFormat {
  id?: number;
  input: string;
  output: string;
}
