import { Test, TestingModule } from '@nestjs/testing';
import { InterviewTimeoutProcessor } from './interview-timeout.processor';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Interview, InterviewStatus } from '../entities/interview.entity';
import { AiInterviewService } from '../services/ai-interview.service';
import { ProgrammingLanguageService } from '../../programming-language/programming-language.service';
import { Job } from 'bullmq';

describe('InterviewTimeoutProcessor', () => {
  let processor: InterviewTimeoutProcessor;

  const mockInterviewRepo = {
    findOne: jest.fn(),
  };

  const mockAiInterviewService = {
    endInterview: jest.fn(),
  };

  const mockLanguagesService = {
    findBySlug: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InterviewTimeoutProcessor,
        {
          provide: getRepositoryToken(Interview),
          useValue: mockInterviewRepo,
        },
        {
          provide: AiInterviewService,
          useValue: mockAiInterviewService,
        },
        {
          provide: ProgrammingLanguageService,
          useValue: mockLanguagesService,
        },
      ],
    }).compile();

    processor = module.get<InterviewTimeoutProcessor>(
      InterviewTimeoutProcessor,
    );

    jest.clearAllMocks();
  });

  describe('process', () => {
    it('should end interview when job executes and interview is ACTIVE', async () => {
      const interviewId = 'test-id-1';
      const mockInterview = {
        id: interviewId,
        status: InterviewStatus.ACTIVE,
        userId: 123,
        problemSnapshot: {},
      };

      mockInterviewRepo.findOne.mockResolvedValue(mockInterview);

      const job = { data: { interviewId } } as Job<{ interviewId: string }>;
      await processor.process(job);

      expect(mockInterviewRepo.findOne).toHaveBeenCalledWith({
        where: { id: interviewId },
      });
      expect(mockAiInterviewService.endInterview).toHaveBeenCalledWith(
        interviewId,
        123,
        undefined,
        undefined,
      );
    });

    it('should skip processing if interview already COMPLETED', async () => {
      const interviewId = 'test-id-2';
      const mockInterview = {
        id: interviewId,
        status: InterviewStatus.COMPLETED,
      };

      mockInterviewRepo.findOne.mockResolvedValue(mockInterview);

      const job = { data: { interviewId } } as Job<{ interviewId: string }>;
      await processor.process(job);

      expect(mockAiInterviewService.endInterview).not.toHaveBeenCalled();
    });

    it('should skip processing if interview not found', async () => {
      const interviewId = 'test-id-3';
      mockInterviewRepo.findOne.mockResolvedValue(null);

      const job = { data: { interviewId } } as Job<{ interviewId: string }>;
      await processor.process(job);

      expect(mockAiInterviewService.endInterview).not.toHaveBeenCalled();
    });

    it('should pass code snapshot to endInterview if available', async () => {
      const interviewId = 'test-id-4';
      const mockLanguage = { id: 63, judge0Id: 63 };
      const mockInterview = {
        id: interviewId,
        status: InterviewStatus.ACTIVE,
        userId: 456,
        problemSnapshot: {
          latestCode: 'console.log("hello")',
          codeLanguage: 'javascript',
        },
      };

      mockInterviewRepo.findOne.mockResolvedValue(mockInterview);
      mockLanguagesService.findBySlug.mockResolvedValue(mockLanguage);

      const job = { data: { interviewId } } as Job<{ interviewId: string }>;
      await processor.process(job);

      expect(mockAiInterviewService.endInterview).toHaveBeenCalledWith(
        interviewId,
        456,
        'console.log("hello")',
        63,
      );
    });
  });
});
