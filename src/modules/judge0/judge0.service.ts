import { Injectable, Logger } from '@nestjs/common';

import {
  Judge0BatchResponse,
  Judge0Response,
  Judge0SubmissionPayload,
} from './interfaces';
import { Judge0HttpClient } from './judge0-http.client';
import { JUDGE0_ENDPOINTS, JUDGE0_QUERY_PARAMS } from './constants';

/**
 * Service for Judge0 code execution platform integration.
 * Handles business logic for submission creation and retrieval.
 */
@Injectable()
export class Judge0Service {
  private readonly logger = new Logger(Judge0Service.name);

  constructor(private readonly httpClient: Judge0HttpClient) {}

  /**
   * Creates batch submissions with callbacks
   * @param items Array of submission payloads
   * @returns Batch submission response with tokens
   */
  async createSubmissionBatch(
    items: Judge0SubmissionPayload[],
  ): Promise<Judge0BatchResponse> {
    const endpoint = this.buildEndpoint(
      JUDGE0_ENDPOINTS.BATCH_SUBMISSIONS,
      JUDGE0_QUERY_PARAMS.BASE64_ENCODED,
    );

    return this.httpClient.post<
      { submissions: Judge0SubmissionPayload[] },
      Judge0BatchResponse
    >(
      endpoint,
      {
        submissions: items,
      },
      'Failed to create batch submission',
    );
  }

  /**
   * Fetches the full details of a single submission from Judge0
   * @param token The token of the submission to fetch
   * @returns Full submission details including status, output, and errors
   */
  async getSubmissionDetails(token: string): Promise<Judge0Response> {
    const endpoint = this.buildEndpoint(
      `${JUDGE0_ENDPOINTS.SUBMISSION_DETAILS}/${token}`,
      JUDGE0_QUERY_PARAMS.BASE64_ENCODED,
      JUDGE0_QUERY_PARAMS.SUBMISSION_FIELDS,
    );

    return this.httpClient.get<Judge0Response>(
      endpoint,
      `Failed to fetch submission details for token ${token}`,
    );
  }

  /**
   * Builds callback URL for Judge0 to notify about submission completion
   * @param submissionId The submission ID
   * @param testcaseId The test case ID
   * @param isSubmit Whether this is a submit (true) or run (false) operation
   * @returns Formatted callback URL
   */
  getCallbackUrl(
    submissionId: string,
    testcaseId: string,
    isSubmit: boolean,
  ): string {
    const callbackType = isSubmit ? 'submit' : 'run';
    const baseUrl = this.httpClient.getCallbackBaseUrl();
    const apiVersion = this.httpClient.getApiVersion();

    return `${baseUrl}/${apiVersion}/submissions/judge0/callback/${callbackType}?sid=${submissionId}&tcid=${testcaseId}`;
  }

  /**
   * Helper method to build endpoint URLs with query parameters
   */
  private buildEndpoint(path: string, ...queryParams: string[]): string {
    const params = queryParams.join('&');
    return `${path}?${params}`;
  }
}
