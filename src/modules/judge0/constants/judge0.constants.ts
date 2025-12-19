/**
 * Judge0 API endpoint constants
 */
export const JUDGE0_ENDPOINTS = {
  BATCH_SUBMISSIONS: '/submissions/batch',
  SUBMISSION_DETAILS: '/submissions',
} as const;

/**
 * Judge0 API query parameters
 */
export const JUDGE0_QUERY_PARAMS = {
  BASE64_ENCODED: 'base64_encoded=true',
  SUBMISSION_FIELDS:
    'fields=token,stdout,time,memory,stderr,compile_output,message,status,expected_output,stdin',
} as const;

/**
 * Judge0 API header names
 */
export const JUDGE0_HEADERS = {
  CONTENT_TYPE: 'Content-Type',
  APPLICATION_JSON: 'application/json',
  RAPID_API_KEY: 'X-RapidAPI-Key',
  RAPID_API_HOST: 'X-RapidAPI-Host',
} as const;
