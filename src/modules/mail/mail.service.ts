import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmailConfig } from '../../config/email.config';
import { MailOptions, MAIL_TRANSPORT } from './interfaces/mail.interface';
import type { MailTransport } from './interfaces/mail.interface';
import { TemplateService } from './services/template.service';

@Injectable()
export class MailService implements OnModuleInit {
  private readonly logger = new Logger(MailService.name);
  private readonly emailConfig: EmailConfig;

  constructor(
    private readonly configService: ConfigService,
    private readonly templateService: TemplateService,
    @Inject(MAIL_TRANSPORT)
    private readonly transport: MailTransport,
  ) {
    this.emailConfig = this.configService.get<EmailConfig>('email')!;
  }

  async onModuleInit() {
    await this.transport.verify();
  }

  async sendTemplatedEmail(
    template: string,
    context: Record<string, any>,
    to: string | string[],
    subject: string,
    options?: Partial<MailOptions>,
  ): Promise<void> {
    try {
      const html = await this.templateService.render(template, context);
      await this.sendMail({
        to,
        subject,
        html,
        ...options,
      });
    } catch (error) {
      this.logger.error(`Failed to send templated email (${template}):`, error);
      throw error;
    }
  }

  /**
   * Send email
   */
  async sendMail(options: MailOptions): Promise<void> {
    try {
      const messageId = await this.transport.send(options);
      this.logger.log(`Email sent successfully: ${messageId}`);
    } catch (error) {
      this.logger.error('Failed to send email:', error);
      throw new Error('Email sending failed');
    }
  }

  /**
   * Send bulk emails
   */
  async sendBulkMail(emails: MailOptions[]): Promise<void> {
    const promises = emails.map((email) => this.sendMail(email));
    await Promise.allSettled(promises);
    this.logger.log(`Bulk email sent: ${emails.length} emails`);
  }

  /**
   * Send welcome email
   */
  async sendWelcomeEmail(
    to: string,
    name: string,
    verificationUrl?: string,
  ): Promise<void> {
    await this.sendTemplatedEmail(
      'welcome',
      { name, verificationUrl },
      to,
      'Welcome to SfinX Platform!',
    );
  }

  /**
   * Send email verification
   */
  async sendVerificationEmail(
    to: string,
    name: string,
    verificationUrl: string,
  ): Promise<void> {
    await this.sendTemplatedEmail(
      'verify-email',
      { name, verificationUrl, expiresIn: '24 hours' },
      to,
      'Verify Your Email Address',
    );
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(
    to: string,
    name: string,
    resetUrl: string,
  ): Promise<void> {
    await this.sendTemplatedEmail(
      'reset-password',
      { name, resetUrl, expiresIn: '1 hour' },
      to,
      'Reset Your Password',
    );
  }

  /**
   * Send password changed confirmation
   */
  async sendPasswordChangedEmail(to: string, name: string): Promise<void> {
    await this.sendTemplatedEmail(
      'password-changed',
      { name, supportEmail: this.emailConfig.from.address },
      to,
      'Password Changed Successfully',
    );
  }

  /**
   * Send submission result email
   */
  async sendSubmissionResultEmail(
    to: string,
    submissionData: {
      userName: string;
      problemTitle: string;
      status: string;
      score?: number;
      submittedAt: Date;
    },
  ): Promise<void> {
    await this.sendTemplatedEmail(
      'submission-result',
      submissionData,
      to,
      `Submission Result: ${submissionData.problemTitle}`,
    );
  }

  /**
   * Send payment success email
   */
  async sendPaymentSuccessEmail(
    to: string,
    data: {
      name: string;
      planName: string;
      amount: number;
      currency: string;
      transactionId: string;
      paymentDate: string;
    },
  ): Promise<void> {
    const currentYear = new Date().getFullYear();
    await this.sendTemplatedEmail(
      'payment-success',
      { ...data, currentYear },
      to,
      'Payment Successful - SfinX Subscription',
    );
  }

  /**
   * Send premium expiring email
   */
  async sendPremiumExpiringEmail(
    to: string,
    data: {
      name: string;
      planName: string;
      expiryDate: string;
      renewUrl: string;
    },
  ): Promise<void> {
    const currentYear = new Date().getFullYear();
    await this.sendTemplatedEmail(
      'premium-expiring',
      { ...data, currentYear },
      to,
      'Your Premium Subscription is Expiring Soon',
    );
  }
}
