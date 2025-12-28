import { Injectable, Logger } from '@nestjs/common';
import DOMPurify from 'isomorphic-dompurify';
import { marked } from 'marked';

/**
 * Validation result for markdown content
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Service for processing and sanitizing markdown content
 * Used for validation and preview functionality across the application
 */
@Injectable()
export class MarkdownService {
  private readonly logger = new Logger(MarkdownService.name);

  constructor() {
    // Configure marked options for GitHub Flavored Markdown
    marked.setOptions({
      gfm: true, // GitHub Flavored Markdown
      breaks: true, // Convert \n to <br>
    });
  }

  /**
   * Parse markdown to HTML and sanitize it
   * Used for preview and validation
   */
  parseAndSanitize(markdown: string): string {
    if (!markdown || markdown.trim().length === 0) {
      return '';
    }

    // Parse markdown to HTML
    const rawHtml = marked.parse(markdown) as string;

    // Sanitize HTML to prevent XSS
    const sanitizedHtml = DOMPurify.sanitize(rawHtml, {
      ALLOWED_TAGS: [
        'p',
        'br',
        'strong',
        'em',
        'u',
        's',
        'code',
        'pre',
        'blockquote',
        'h1',
        'h2',
        'h3',
        'h4',
        'h5',
        'h6',
        'ul',
        'ol',
        'li',
        'a',
        'img',
        'table',
        'thead',
        'tbody',
        'tr',
        'th',
        'td',
        'hr',
      ],
      ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class'],
      ALLOW_DATA_ATTR: false,
      ALLOWED_URI_REGEXP:
        /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp):|[^a-z]|[a-z+.-]+(?:[^a-z+.-:]|$))/i,
    });

    return sanitizedHtml;
  }

  /**
   * Validate markdown content
   * Returns validation result with any errors
   */
  validateMarkdown(markdown: string): ValidationResult {
    const errors: string[] = [];

    if (!markdown || markdown.trim().length === 0) {
      errors.push('Content cannot be empty');
      return { isValid: false, errors };
    }

    // Check for extremely long content
    if (markdown.length > 10000) {
      errors.push('Content exceeds maximum length of 10,000 characters');
    }

    // Check for dangerous patterns
    if (this.containsDangerousContent(markdown)) {
      errors.push('Content contains potentially unsafe patterns');
    }

    // Try to parse and sanitize
    try {
      const sanitized = this.parseAndSanitize(markdown);

      // Check if sanitization removed everything (might indicate malicious content)
      if (sanitized.trim().length === 0 && markdown.trim().length > 0) {
        errors.push('Content contains invalid or unsafe markdown');
      }
    } catch (error) {
      errors.push('Failed to parse markdown content');
      this.logger.error(error instanceof Error ? error.message : String(error));
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Extract plain text from markdown (removes formatting)
   * Useful for search indexing or previews
   */
  extractPlainText(markdown: string): string {
    if (!markdown) return '';

    const html = this.parseAndSanitize(markdown);

    // Strip HTML tags
    return html.replace(/<[^>]*>/g, '').trim();
  }

  /**
   * Get a preview of markdown content (first N characters of plain text)
   */
  getPreview(markdown: string, maxLength: number = 200): string {
    const plainText = this.extractPlainText(markdown);

    if (plainText.length <= maxLength) {
      return plainText;
    }

    return plainText.substring(0, maxLength).trim() + '...';
  }

  /**
   * Check if markdown contains potentially dangerous patterns
   */
  private containsDangerousContent(markdown: string): boolean {
    // Check for script tags (even though they'll be sanitized)
    if (/<script/i.test(markdown)) return true;

    // Check for javascript: protocol
    if (/javascript:/i.test(markdown)) return true;

    // Check for data: URIs (can be used for XSS)
    if (/data:text\/html/i.test(markdown)) return true;

    // Check for excessive nested structures (potential DoS)
    const nestingLevel = (markdown.match(/\[/g) || []).length;
    if (nestingLevel > 10) return true;

    return false;
  }
}
