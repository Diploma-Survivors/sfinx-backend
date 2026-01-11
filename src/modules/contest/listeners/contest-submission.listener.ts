import { Injectable, Logger } from '@nestjs/common';
import { ContestSubmissionService } from '../services';

@Injectable()
export class ContestSubmissionListener {
  private readonly logger = new Logger(ContestSubmissionListener.name);

  constructor(
    private readonly contestSubmissionService: ContestSubmissionService,
  ) {}
}
