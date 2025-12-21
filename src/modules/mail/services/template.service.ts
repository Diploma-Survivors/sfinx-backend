import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Handlebars from 'handlebars';
import * as fs from 'fs/promises';
import * as path from 'path';
import { EmailConfig } from '../../../config/email.config';

@Injectable()
export class TemplateService {
  private readonly logger = new Logger(TemplateService.name);
  private readonly templatesDir: string;
  private readonly templateCache = new Map<
    string,
    HandlebarsTemplateDelegate
  >();

  constructor(private readonly configService: ConfigService) {
    const emailConfig = this.configService.get<EmailConfig>('email')!;
    this.templatesDir = emailConfig.templatesDir;
    this.registerHelpers();
  }

  /**
   * Render a template with context data
   */
  async render(
    templateName: string,
    context: Record<string, any> = {},
  ): Promise<string> {
    try {
      const template = await this.getTemplate(templateName);
      return template(context);
    } catch (error) {
      this.logger.error(`Failed to render template ${templateName}:`, error);
      throw new Error(`Template rendering failed: ${templateName}`);
    }
  }

  /**
   * Get compiled template (with caching)
   */
  private async getTemplate(
    templateName: string,
  ): Promise<HandlebarsTemplateDelegate> {
    // Check cache first
    if (this.templateCache.has(templateName)) {
      return this.templateCache.get(templateName)!;
    }

    // Load and compile template
    const templatePath = path.join(this.templatesDir, `${templateName}.hbs`);
    const templateContent = await fs.readFile(templatePath, 'utf-8');
    const compiled = Handlebars.compile(templateContent);

    // Cache for future use
    this.templateCache.set(templateName, compiled);
    this.logger.log(`Compiled and cached template: ${templateName}`);

    return compiled;
  }

  /**
   * Clear template cache (useful for development/testing)
   */
  clearCache(): void {
    this.templateCache.clear();
    this.logger.log('Template cache cleared');
  }

  /**
   * Register custom Handlebars helpers
   */
  private registerHelpers(): void {
    // Format date helper
    Handlebars.registerHelper('formatDate', (date: Date | string) => {
      const d = typeof date === 'string' ? new Date(date) : date;
      return d.toLocaleDateString('vi-VN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    });

    // Format time helper
    Handlebars.registerHelper('formatTime', (date: Date | string) => {
      const d = typeof date === 'string' ? new Date(date) : date;
      return d.toLocaleTimeString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
      });
    });

    // Uppercase helper
    Handlebars.registerHelper('uppercase', (str: string) => {
      return str ? str.toUpperCase() : '';
    });

    // Lowercase helper
    Handlebars.registerHelper('lowercase', (str: string) => {
      return str ? str.toLowerCase() : '';
    });

    // Conditional equality helper
    Handlebars.registerHelper('eq', (a: any, b: any) => {
      return a === b;
    });

    // Conditional greater than helper
    Handlebars.registerHelper('gt', (a: number, b: number) => {
      return a > b;
    });

    this.logger.log('Handlebars helpers registered');
  }
}
