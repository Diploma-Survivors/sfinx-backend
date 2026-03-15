import { Injectable } from '@nestjs/common';
import { PromptService } from '../../ai/prompt.service';
import {
  InterviewMode,
  InterviewDifficulty,
  InterviewerPersonality,
} from '../enums';

@Injectable()
export class PromptInjectionService {
  constructor(private readonly promptService: PromptService) {}

  private readonly promptMapping = {
    personality: {
      [InterviewerPersonality.EASY_GOING]: 'personality-easy-going',
      [InterviewerPersonality.STRICT]: 'personality-strict',
      [InterviewerPersonality.JACKASS]: 'personality-jackass',
    },
    difficulty: {
      [InterviewDifficulty.ENTRY]: 'difficulty-entry',
      [InterviewDifficulty.EXPERIENCED]: 'difficulty-experienced',
      [InterviewDifficulty.SENIOR]: 'difficulty-senior',
    },
    mode: {
      [InterviewMode.SHORT]: 'time-30min',
      [InterviewMode.STANDARD]: 'time-45min',
      [InterviewMode.LONG]: 'time-60min',
    },
  };

  async getPromptVariables(
    mode: InterviewMode,
    difficulty: InterviewDifficulty,
    personality: InterviewerPersonality,
  ): Promise<Record<string, string>> {
    const [personalityDirective, difficultyExpectations, timeConstraint] =
      await Promise.all([
        this.promptService
          .getCompiledPrompt(this.promptMapping.personality[personality], {})
          .catch(() => this.getFallbackPersonality(personality)),
        this.promptService
          .getCompiledPrompt(this.promptMapping.difficulty[difficulty], {})
          .catch(() => this.getFallbackDifficulty(difficulty)),
        this.promptService
          .getCompiledPrompt(this.promptMapping.mode[mode], {})
          .catch(() => this.getFallbackTime(mode)),
      ]);

    return {
      personalityDirective,
      difficultyExpectations,
      timeConstraint,
    };
  }

  // Fallback methods in case Langfuse is unavailable
  private getFallbackPersonality(personality: InterviewerPersonality): string {
    const fallbacks: Record<InterviewerPersonality, string> = {
      [InterviewerPersonality.EASY_GOING]:
        'You are a friendly, encouraging interviewer.',
      [InterviewerPersonality.STRICT]:
        'You are a professional, direct interviewer.',
      [InterviewerPersonality.JACKASS]:
        'You are a demanding, skeptical interviewer.',
    };
    return fallbacks[personality];
  }

  private getFallbackDifficulty(difficulty: InterviewDifficulty): string {
    const fallbacks: Record<InterviewDifficulty, string> = {
      [InterviewDifficulty.ENTRY]: 'Expect basic algorithmic understanding.',
      [InterviewDifficulty.EXPERIENCED]: 'Expect clean, working code.',
      [InterviewDifficulty.SENIOR]: 'Expect optimal solutions.',
    };
    return fallbacks[difficulty];
  }

  private getFallbackTime(mode: InterviewMode): string {
    const fallbacks: Record<InterviewMode, string> = {
      [InterviewMode.SHORT]: 'This is a 30-minute interview.',
      [InterviewMode.STANDARD]: 'This is a 45-minute interview.',
      [InterviewMode.LONG]: 'This is a 60-minute interview.',
    };
    return fallbacks[mode];
  }
}
