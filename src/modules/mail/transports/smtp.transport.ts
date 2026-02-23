import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { Transporter } from 'nodemailer';
import { EmailConfig } from '../../../config/email.config';
import type { MailTransport } from '../interfaces/mail.interface';
import { MailOptions } from '../interfaces/mail.interface';

@Injectable()
export class SmtpTransport implements MailTransport {
  private readonly logger = new Logger(SmtpTransport.name);
  private readonly transporter: Transporter;
  private readonly fromAddress: string;

  constructor(private readonly configService: ConfigService) {
    const emailConfig = this.configService.get<EmailConfig>('email')!;
    this.fromAddress = `"${emailConfig.from.name}" <${emailConfig.from.address}>`;
    this.transporter = nodemailer.createTransport({
      host: emailConfig.host,
      port: emailConfig.port,
      secure: emailConfig.secure,
      auth: {
        user: emailConfig.auth.user,
        pass: emailConfig.auth.pass,
      },
    });
  }

  async verify(): Promise<void> {
    try {
      await this.transporter.verify();
      this.logger.log('SMTP connection verified successfully');
    } catch (error) {
      this.logger.error('SMTP connection verification failed:', error);
    }
  }

  async send(options: MailOptions): Promise<string | undefined> {
    const { to, subject, html, text, attachments, replyTo } = options;

    const mailOptions: nodemailer.SendMailOptions = {
      from: this.fromAddress,
      to: Array.isArray(to) ? to.join(', ') : to,
      subject,
      html,
      text,
      replyTo,
    };

    if (attachments?.length) {
      mailOptions.attachments = attachments.map((att) => ({
        filename: att.filename,
        content: att.content,
        contentType: att.contentType,
      }));
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const info = await this.transporter.sendMail(mailOptions);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    return info.messageId as string | undefined;
  }
}
