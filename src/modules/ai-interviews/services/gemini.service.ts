import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  GoogleGenerativeAI,
  GenerativeModel,
  ChatSession,
  Content,
} from '@google/generative-ai';

@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);
  private readonly genAI: GoogleGenerativeAI;
  private readonly model: GenerativeModel;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    const modelName =
      this.configService.get<string>('GEMINI_MODEL') || 'gemini-1.5-pro';

    if (!apiKey) {
      this.logger.warn('GEMINI_API_KEY is not set. AI features will not work.');
    }

    this.genAI = new GoogleGenerativeAI(apiKey || '');
    this.model = this.genAI.getGenerativeModel({ model: modelName });
  }

  startChat(history: Content[]): ChatSession {
    return this.model.startChat({
      history,
    });
  }

  async generateContent(prompt: string): Promise<string> {
    const result = await this.model.generateContent(prompt);
    return result.response.text();
  }
}
