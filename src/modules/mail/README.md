# Mail Module

Production-ready email module for SfinX Platform with template support, queue processing, and comprehensive error handling.

## Features

- ✅ **Template Engine**: Handlebars-based email templates with layouts and partials
- ✅ **Queue Support**: Background email processing with BullMQ
- ✅ **Retry Logic**: Automatic retry with exponential backoff
- ✅ **Multiple Templates**: Welcome, verification, password reset, submission results
- ✅ **Responsive Design**: Mobile-friendly emails with dark mode support
- ✅ **Type Safety**: Full TypeScript support with DTOs and interfaces

## Usage

### Basic Email

```typescript
import { MailService } from '@modules/mail';

// Inject in your service
constructor(private readonly mailService: MailService) {}

// Send email
await this.mailService.sendMail({
  to: 'user@example.com',
  subject: 'Hello',
  html: '<p>Hello World!</p>',
});
```

### Templated Email

```typescript
await this.mailService.sendTemplatedEmail(
  'welcome',
  { name: 'John Doe', verificationUrl: 'https://...' },
  'user@example.com',
  'Welcome to SfinX!',
);
```

### Helper Methods

```typescript
// Welcome email
await this.mailService.sendWelcomeEmail(
  'user@example.com',
  'John Doe',
  'https://verify-url',
);

// Email verification
await this.mailService.sendVerificationEmail(
  'user@example.com',
  'John Doe',
  'https://verify-url',
);

// Password reset
await this.mailService.sendPasswordResetEmail(
  'user@example.com',
  'John Doe',
  'https://reset-url',
);

// Password changed
await this.mailService.sendPasswordChangedEmail('user@example.com', 'John Doe');

// Submission result
await this.mailService.sendSubmissionResultEmail('user@example.com', {
  userName: 'John Doe',
  problemTitle: 'Two Sum',
  status: 'Accepted',
  score: 100,
  submittedAt: new Date(),
});
```

## Configuration

Add to `.env`:

```env
# SMTP Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM=noreply@sfinx.com
SMTP_FROM_NAME=SfinX Platform

# Mail Queue (optional)
MAIL_QUEUE_ENABLED=true
```

## Templates

Templates are located in `src/modules/mail/templates/`:

- `welcome.hbs` - Welcome new users
- `verify-email.hbs` - Email verification
- `reset-password.hbs` - Password reset
- `password-changed.hbs` - Password change confirmation
- `submission-result.hbs` - Code submission results

### Custom Templates

Create new `.hbs` files in the templates directory:

```handlebars
<h2>Hello {{name}}!</h2>
<p>Your custom content here.</p>

{{#if showButton}}
  <a href='{{buttonUrl}}' class='button'>Click Me</a>
{{/if}}
```

Use custom helpers:

- `{{formatDate date}}` - Format date
- `{{formatTime date}}` - Format time
- `{{uppercase text}}` - Convert to uppercase
- `{{lowercase text}}` - Convert to lowercase
- `{{#eq a b}}...{{/eq}}` - Equality check
- `{{#gt a b}}...{{/gt}}` - Greater than check

## Queue Processing

Emails are processed in the background using BullMQ with:

- **3 retry attempts** with exponential backoff
- **2-second initial delay** between retries
- **Automatic cleanup** of completed jobs

## Error Handling

- SMTP connection verified on startup
- Failed emails logged with details
- Retry mechanism for transient failures
- Graceful degradation on critical failures

## Testing

For development, use [Mailtrap](https://mailtrap.io/) or [MailHog](https://github.com/mailhog/MailHog):

```env
SMTP_HOST=smtp.mailtrap.io
SMTP_PORT=2525
SMTP_USER=your-mailtrap-user
SMTP_PASSWORD=your-mailtrap-password
```

## Architecture

```
mail/
├── dto/
│   └── send-mail.dto.ts          # Email DTOs
├── interfaces/
│   └── mail.interface.ts         # Type definitions
├── processors/
│   └── mail.processor.ts         # Queue processor
├── services/
│   └── template.service.ts       # Template engine
├── templates/
│   ├── layouts/
│   │   └── base.hbs             # Base layout
│   ├── welcome.hbs
│   ├── verify-email.hbs
│   ├── reset-password.hbs
│   ├── password-changed.hbs
│   └── submission-result.hbs
├── mail.service.ts               # Core mail service
├── mail.module.ts                # Module definition
└── index.ts                      # Exports
```

## Best Practices

1. **Use templates** for consistent branding
2. **Queue emails** for better performance
3. **Monitor queue** for failed jobs
4. **Test templates** before deploying
5. **Keep content concise** and actionable
