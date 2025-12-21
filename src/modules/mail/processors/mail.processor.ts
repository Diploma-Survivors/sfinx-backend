import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { MailService } from '../mail.service';
import { MailOptions } from '../interfaces/mail.interface';

@Processor('mail')
export class MailProcessor extends WorkerHost {
  private readonly logger = new Logger(MailProcessor.name);

  constructor(private readonly mailService: MailService) {
    super();
  }

  async process(job: Job<MailOptions>): Promise<void> {
    this.logger.log(`Processing mail job ${job.id}`);

    try {
      const { template, context, ...mailOptions } = job.data;

      if (template && context) {
        // Send templated email
        await this.mailService.sendTemplatedEmail(
          template,
          context,
          mailOptions.to,
          mailOptions.subject,
          mailOptions,
        );
      } else {
        // Send regular email
        await this.mailService.sendMail(job.data);
      }

      this.logger.log(`Mail job ${job.id} completed successfully`);
    } catch (error) {
      this.logger.error(`Mail job ${job.id} failed:`, error);
      throw error; // Will trigger retry
    }
  }
}
