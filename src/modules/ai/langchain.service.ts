import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { HumanMessage, BaseMessage } from '@langchain/core/messages';
import { RunnableConfig } from '@langchain/core/runnables';

export interface LlmCallOptions {
  threadId: string;
  runName: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class LangChainService {
  private readonly logger = new Logger(LangChainService.name);
  private readonly model: ChatGoogleGenerativeAI;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    const modelName =
      this.configService.get<string>('GEMINI_MODEL') || 'gemini-1.5-pro';

    if (!apiKey) {
      this.logger.warn('GEMINI_API_KEY is not set. AI features will not work.');
    }

    this.model = new ChatGoogleGenerativeAI({
      apiKey: apiKey || '',
      model: modelName,
    });
  }

  private buildConfig(options: LlmCallOptions): RunnableConfig {
    return {
      runName: options.runName,
      metadata: {
        threadId: options.threadId,
        ...options.metadata,
      },
      configurable: {
        thread_id: options.threadId,
      },
      tags: [options.runName],
    };
  }

  async generateContent(
    prompt: string,
    options: LlmCallOptions,
  ): Promise<string> {
    const config = this.buildConfig(options);
    const messages: BaseMessage[] = [new HumanMessage(prompt)];
    const response = await this.model.invoke(messages, config);
    const content = response.content;
    return typeof content === 'string' ? content : JSON.stringify(content);
  }

  async chat(
    history: BaseMessage[],
    userMessage: string,
    options: LlmCallOptions,
  ): Promise<string> {
    const config = this.buildConfig(options);
    const messages: BaseMessage[] = [...history, new HumanMessage(userMessage)];
    const response = await this.model.invoke(messages, config);
    const content = response.content;
    return typeof content === 'string' ? content : JSON.stringify(content);
  }

  async *streamChat(
    history: BaseMessage[],
    userMessage: string,
    options: LlmCallOptions,
  ): AsyncGenerator<string> {
    const config = this.buildConfig(options);
    const messages: BaseMessage[] = [...history, new HumanMessage(userMessage)];
    const stream = await this.model.stream(messages, config);
    for await (const chunk of stream) {
      const content = chunk.content;
      if (typeof content === 'string') {
        if (content) yield content;
      } else if (Array.isArray(content)) {
        for (const part of content) {
          if (typeof part === 'string' && part) yield part;
          else if (
            typeof part === 'object' &&
            part !== null &&
            'type' in part &&
            part.type === 'text' &&
            'text' in part &&
            typeof part.text === 'string' &&
            part.text
          ) {
            yield part.text;
          }
        }
      }
    }
  }
}
