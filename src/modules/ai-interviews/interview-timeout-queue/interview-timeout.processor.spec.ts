import { Test, TestingModule } from '@nestjs/testing';
import { InterviewTimeoutProcessor } from './interview-timeout.processor';
import { InterviewTimeoutService } from './interview-timeout.service';
import { Job } from 'bullmq';

describe('InterviewTimeoutProcessor', () => {
  let processor: InterviewTimeoutProcessor;

  const mockTimeoutService = {
    autoEndInterview: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InterviewTimeoutProcessor,
        {
          provide: InterviewTimeoutService,
          useValue: mockTimeoutService,
        },
      ],
    }).compile();

    processor = module.get<InterviewTimeoutProcessor>(
      InterviewTimeoutProcessor,
    );

    jest.clearAllMocks();
  });

  describe('process', () => {
    it('should call autoEndInterview when processing job', async () => {
      const interviewId = 'test-id-1';
      mockTimeoutService.autoEndInterview.mockResolvedValue({});

      const job = { data: { interviewId } } as Job<{ interviewId: string }>;
      await processor.process(job);

      expect(mockTimeoutService.autoEndInterview).toHaveBeenCalledWith(
        interviewId,
      );
    });

    it('should handle errors and re-throw for retry', async () => {
      const interviewId = 'test-id-2';
      mockTimeoutService.autoEndInterview.mockRejectedValue(
        new Error('Failed'),
      );

      const job = { data: { interviewId } } as Job<{ interviewId: string }>;

      await expect(processor.process(job)).rejects.toThrow('Failed');
    });
  });
});
