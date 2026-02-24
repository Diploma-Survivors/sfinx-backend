import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { EmailConfig } from '../../../config/email.config';
import type { MailTransport } from '../interfaces/mail.interface';
import { MailOptions } from '../interfaces/mail.interface';

@Injectable()
export class BrevoTransport implements MailTransport {
  private readonly logger = new Logger(BrevoTransport.name);
  private readonly apiKey: string;
  private readonly apiUrl: string;
  private readonly senderName: string;
  private readonly senderEmail: string;

  constructor(private readonly configService: ConfigService) {
    const emailConfig = this.configService.get<EmailConfig>('email')!;
    this.apiKey = emailConfig.brevo.apiKey;
    this.apiUrl = emailConfig.brevo.apiUrl;
    this.senderName = emailConfig.brevo.fromName;
    this.senderEmail = emailConfig.brevo.fromEmail;
  }

  async verify(): Promise<void> {
    try {
      await axios.get(`${this.apiUrl}/account`, {
        headers: this.buildHeaders(),
      });
      this.logger.log('Brevo API connection verified successfully');
    } catch (error: unknown) {
      const errorMsg = this.extractErrorMessage(error);
      this.logger.error('Brevo API connection verification failed:', errorMsg);
    }
  }

  async send(options: MailOptions): Promise<string | undefined> {
    const payload = this.buildPayload(options);

    const response = await axios.post(`${this.apiUrl}/smtp/email`, payload, {
      headers: this.buildHeaders(),
    });

    const data = response.data as { messageId?: string };
    return data.messageId;
  }

  private buildHeaders(): Record<string, string> {
    return {
      'api-key': this.apiKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
  }

  private buildPayload(options: MailOptions): Record<string, unknown> {
    const { to, subject, html, text, attachments, replyTo } = options;

    const toList = Array.isArray(to)
      ? to.map((email) => ({ email }))
      : [{ email: to }];

    const payload: Record<string, unknown> = {
      sender: { name: this.senderName, email: this.senderEmail },
      to: toList,
      subject,
    };

    if (html) {
      payload.htmlContent = html;
    }

    if (text) {
      payload.textContent = text;
    }

    if (replyTo) {
      payload.replyTo = { email: replyTo };
    }

    if (attachments?.length) {
      payload.attachment = attachments.map((att) => ({
        name: att.filename,
        content: Buffer.isBuffer(att.content)
          ? att.content.toString('base64')
          : Buffer.from(att.content).toString('base64'),
      }));
    }

    return payload;
  }

  private extractErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      const axiosError = error as Error & { response?: { data?: unknown } };
      if (axiosError.response?.data) {
        return JSON.stringify(axiosError.response.data);
      }
      return error.message;
    }
    return String(error);
  }
}
