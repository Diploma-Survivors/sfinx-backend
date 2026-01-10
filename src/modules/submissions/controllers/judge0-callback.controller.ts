import { Body, Controller, HttpCode, Logger, Put, Query } from '@nestjs/common';
import { ApiExcludeController, ApiTags } from '@nestjs/swagger';

import type { Judge0Response } from '../../judge0/interfaces';
import { CallbackProcessorService } from '../services';

/**
 * Controller for handling Judge0 callbacks
 * This endpoint is called by Judge0 when a submission is processed
 */
@ApiTags('Judge0 Callbacks')
@ApiExcludeController() // Exclude from Swagger as this is an internal callback endpoint
@Controller('submissions/judge0/callback')
export class Judge0CallbackController {
  private readonly logger = new Logger(Judge0CallbackController.name);

  constructor(private readonly callbackProcessor: CallbackProcessorService) {}

  /**
   * Handle callback for submit mode
   */
  @Put('submit')
  @HttpCode(204)
  // eslint-disable-next-line @typescript-eslint/require-await
  async handleSubmitCallback(
    @Query('sid') submissionId: string,
    @Query('tcid') testcaseId: string,
    @Body() payload: Judge0Response,
  ) {
    this.logger.debug(
      `Received submit callback: sid=${submissionId}, tcid=${testcaseId}, token=${payload.token}`,
    );

    this.callbackProcessor
      .handleCallback(
        submissionId,
        Number.parseInt(testcaseId),
        payload,
        true, // isSubmit = true
      )
      .catch(() => {
        this.logger.error(
          `Failed to process submit callback: sid=${submissionId}, tcid=${testcaseId}, token=${payload.token}`,
        );
      });
  }

  /**
   * Handle callback for run mode
   */
  @Put('run')
  @HttpCode(204)
  // eslint-disable-next-line @typescript-eslint/require-await
  async handleRunCallback(
    @Query('sid') submissionId: string,
    @Query('tcid') testcaseId: string,
    @Body() payload: Judge0Response,
  ) {
    this.logger.debug(
      `Received run callback: sid=${submissionId}, tcid=${testcaseId}, token=${payload.token}`,
    );

    this.callbackProcessor
      .handleCallback(
        submissionId,
        Number.parseInt(testcaseId),
        payload,
        false, // isSubmit = false
      )
      .catch(() => {
        this.logger.error(
          `Failed to process run callback: sid=${submissionId}, tcid=${testcaseId}, token=${payload.token}`,
        );
      });
  }
}
