export interface MailOptions {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  template?: string;
  context?: Record<string, any>;
  attachments?: Array<{
    filename: string;
    content: string | Buffer;
    contentType?: string;
  }>;
  replyTo?: string;
}

export interface TemplateContext {
  [key: string]: any;
}

export enum EmailTemplate {
  WELCOME = 'welcome',
  VERIFY_EMAIL = 'verify-email',
  RESET_PASSWORD = 'reset-password',
  PASSWORD_CHANGED = 'password-changed',
  SUBMISSION_RESULT = 'submission-result',
}

export const MAIL_TRANSPORT = Symbol('MAIL_TRANSPORT');

export interface MailTransport {
  verify(): Promise<void>;
  send(options: MailOptions): Promise<string | undefined>;
}
