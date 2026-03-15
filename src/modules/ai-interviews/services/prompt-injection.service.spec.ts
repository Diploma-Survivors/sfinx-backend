import { Test, TestingModule } from '@nestjs/testing';
import { PromptInjectionService } from './prompt-injection.service';
import { PromptService } from '../../ai/prompt.service';
import {
  InterviewMode,
  InterviewDifficulty,
  InterviewerPersonality,
} from '../enums';

describe('PromptInjectionService', () => {
  let service: PromptInjectionService;
  let promptService: jest.Mocked<PromptService>;

  const mockPromptService = {
    getCompiledPrompt: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PromptInjectionService,
        {
          provide: PromptService,
          useValue: mockPromptService,
        },
      ],
    }).compile();

    service = module.get<PromptInjectionService>(PromptInjectionService);
    promptService = module.get(PromptService);

    // Reset mocks
    jest.clearAllMocks();
  });

  describe('getPromptVariables', () => {
    it('should fetch all three prompts from Langfuse', async () => {
      // Arrange
      promptService.getCompiledPrompt
        .mockResolvedValueOnce('Personality directive')
        .mockResolvedValueOnce('Difficulty expectations')
        .mockResolvedValueOnce('Time constraint');

      // Act
      await service.getPromptVariables(
        InterviewMode.STANDARD,
        InterviewDifficulty.ENTRY,
        InterviewerPersonality.EASY_GOING,
      );

      // Assert
      expect(promptService.getCompiledPrompt).toHaveBeenCalledTimes(3);
      expect(promptService.getCompiledPrompt).toHaveBeenCalledWith(
        'personality-easy-going',
        {},
      );
      expect(promptService.getCompiledPrompt).toHaveBeenCalledWith(
        'difficulty-entry',
        {},
      );
      expect(promptService.getCompiledPrompt).toHaveBeenCalledWith(
        'time-45min',
        {},
      );
    });

    it('should return correct prompt variables structure', async () => {
      // Arrange
      promptService.getCompiledPrompt
        .mockResolvedValueOnce('Easy going personality')
        .mockResolvedValueOnce('Entry level expectations')
        .mockResolvedValueOnce('45 minute constraint');

      // Act
      const result = await service.getPromptVariables(
        InterviewMode.STANDARD,
        InterviewDifficulty.ENTRY,
        InterviewerPersonality.EASY_GOING,
      );

      // Assert
      expect(result).toEqual({
        personalityDirective: 'Easy going personality',
        difficultyExpectations: 'Entry level expectations',
        timeConstraint: '45 minute constraint',
      });
    });

    it('should map InterviewMode correctly', async () => {
      // Test all mode mappings
      const modeMappings = [
        { mode: InterviewMode.SHORT, expected: 'time-30min' },
        { mode: InterviewMode.STANDARD, expected: 'time-45min' },
        { mode: InterviewMode.LONG, expected: 'time-60min' },
      ];

      for (const { mode, expected } of modeMappings) {
        jest.clearAllMocks();
        promptService.getCompiledPrompt.mockResolvedValue('');

        await service.getPromptVariables(
          mode,
          InterviewDifficulty.ENTRY,
          InterviewerPersonality.EASY_GOING,
        );

        expect(promptService.getCompiledPrompt).toHaveBeenCalledWith(
          expected,
          {},
        );
      }
    });

    it('should map InterviewDifficulty correctly', async () => {
      // Test all difficulty mappings
      const difficultyMappings = [
        { difficulty: InterviewDifficulty.ENTRY, expected: 'difficulty-entry' },
        {
          difficulty: InterviewDifficulty.EXPERIENCED,
          expected: 'difficulty-experienced',
        },
        {
          difficulty: InterviewDifficulty.SENIOR,
          expected: 'difficulty-senior',
        },
      ];

      for (const { difficulty, expected } of difficultyMappings) {
        jest.clearAllMocks();
        promptService.getCompiledPrompt.mockResolvedValue('');

        await service.getPromptVariables(
          InterviewMode.STANDARD,
          difficulty,
          InterviewerPersonality.EASY_GOING,
        );

        expect(promptService.getCompiledPrompt).toHaveBeenCalledWith(
          expected,
          {},
        );
      }
    });

    it('should map InterviewerPersonality correctly', async () => {
      // Test all personality mappings
      const personalityMappings = [
        {
          personality: InterviewerPersonality.EASY_GOING,
          expected: 'personality-easy-going',
        },
        {
          personality: InterviewerPersonality.STRICT,
          expected: 'personality-strict',
        },
        {
          personality: InterviewerPersonality.JACKASS,
          expected: 'personality-jackass',
        },
      ];

      for (const { personality, expected } of personalityMappings) {
        jest.clearAllMocks();
        promptService.getCompiledPrompt.mockResolvedValue('');

        await service.getPromptVariables(
          InterviewMode.STANDARD,
          InterviewDifficulty.ENTRY,
          personality,
        );

        expect(promptService.getCompiledPrompt).toHaveBeenCalledWith(
          expected,
          {},
        );
      }
    });

    it('should use fallback text when Langfuse is unavailable', async () => {
      // Arrange
      promptService.getCompiledPrompt.mockRejectedValue(
        new Error('Langfuse down'),
      );

      // Act
      const result = await service.getPromptVariables(
        InterviewMode.STANDARD,
        InterviewDifficulty.ENTRY,
        InterviewerPersonality.EASY_GOING,
      );

      // Assert
      expect(result).toEqual({
        personalityDirective: 'You are a friendly, encouraging interviewer.',
        difficultyExpectations: 'Expect basic algorithmic understanding.',
        timeConstraint: 'This is a 45-minute interview.',
      });
    });

    it('should handle mixed success/failure from Langfuse', async () => {
      // Arrange - first succeeds, second fails, third succeeds
      promptService.getCompiledPrompt
        .mockResolvedValueOnce('Custom personality')
        .mockRejectedValueOnce(new Error('Difficulty prompt not found'))
        .mockResolvedValueOnce('Custom time');

      // Act
      const result = await service.getPromptVariables(
        InterviewMode.STANDARD,
        InterviewDifficulty.SENIOR,
        InterviewerPersonality.JACKASS,
      );

      // Assert
      expect(result).toEqual({
        personalityDirective: 'Custom personality',
        difficultyExpectations: 'Expect optimal solutions.',
        timeConstraint: 'Custom time',
      });
    });
  });

  describe('fallback methods', () => {
    it('should return correct fallback for EASY_GOING personality', async () => {
      promptService.getCompiledPrompt.mockRejectedValue(new Error('fail'));

      const result = await service.getPromptVariables(
        InterviewMode.STANDARD,
        InterviewDifficulty.ENTRY,
        InterviewerPersonality.EASY_GOING,
      );

      expect(result.personalityDirective).toContain('friendly');
    });

    it('should return correct fallback for STRICT personality', async () => {
      promptService.getCompiledPrompt.mockRejectedValue(new Error('fail'));

      const result = await service.getPromptVariables(
        InterviewMode.STANDARD,
        InterviewDifficulty.ENTRY,
        InterviewerPersonality.STRICT,
      );

      expect(result.personalityDirective).toContain('professional');
    });

    it('should return correct fallback for JACKASS personality', async () => {
      promptService.getCompiledPrompt.mockRejectedValue(new Error('fail'));

      const result = await service.getPromptVariables(
        InterviewMode.STANDARD,
        InterviewDifficulty.ENTRY,
        InterviewerPersonality.JACKASS,
      );

      expect(result.personalityDirective).toContain('demanding');
    });

    it('should return correct fallback for SENIOR difficulty', async () => {
      promptService.getCompiledPrompt.mockRejectedValue(new Error('fail'));

      const result = await service.getPromptVariables(
        InterviewMode.STANDARD,
        InterviewDifficulty.SENIOR,
        InterviewerPersonality.EASY_GOING,
      );

      expect(result.difficultyExpectations).toContain('optimal');
    });

    it('should return correct fallback for 60min mode', async () => {
      promptService.getCompiledPrompt.mockRejectedValue(new Error('fail'));

      const result = await service.getPromptVariables(
        InterviewMode.LONG,
        InterviewDifficulty.ENTRY,
        InterviewerPersonality.EASY_GOING,
      );

      expect(result.timeConstraint).toContain('60-minute');
    });
  });
});
