import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class EmailAttachmentDto {
  @ApiProperty({ description: 'Attachment filename' })
  @IsString()
  @IsNotEmpty()
  filename: string;

  @ApiProperty({ description: 'Attachment content or path' })
  @IsNotEmpty()
  content: string | Buffer;

  @ApiProperty({ description: 'Content type', required: false })
  @IsOptional()
  @IsString()
  contentType?: string;
}

export class SendMailDto {
  @ApiProperty({
    description: 'Recipient email address(es)',
    example: 'user@example.com',
  })
  @IsNotEmpty()
  to: string | string[];

  @ApiProperty({ description: 'Email subject' })
  @IsString()
  @IsNotEmpty()
  subject: string;

  @ApiProperty({
    description: 'Template name to use',
    example: 'welcome',
    required: false,
  })
  @IsOptional()
  @IsString()
  template?: string;

  @ApiProperty({
    description: 'Template context data',
    required: false,
  })
  @IsOptional()
  context?: Record<string, any>;

  @ApiProperty({ description: 'HTML content', required: false })
  @IsOptional()
  @IsString()
  html?: string;

  @ApiProperty({ description: 'Plain text content', required: false })
  @IsOptional()
  @IsString()
  text?: string;

  @ApiProperty({
    description: 'Email attachments',
    type: [EmailAttachmentDto],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EmailAttachmentDto)
  attachments?: EmailAttachmentDto[];

  @ApiProperty({
    description: 'Reply-to address',
    required: false,
  })
  @IsOptional()
  @IsEmail()
  replyTo?: string;
}
