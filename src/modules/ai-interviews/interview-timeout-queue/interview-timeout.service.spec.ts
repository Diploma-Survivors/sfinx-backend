import { Test, TestingModule } from '@nestjs/testing';
import { InterviewTimeoutService } from './interview-timeout.service';
import { getQueueToken } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { InterviewMode } from '../enums';

describe('InterviewTimeoutService', () => {
  let service: InterviewTimeoutService;
  let queue: Queue;

  const mockQueue = {
    add: jest.fn(),
    getJob: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InterviewTimeoutService,
        {
          provide: getQueueToken('interview-timeout'),
          useValue: mockQueue,
        },
      ],
    }).compile();

    service = module.get<InterviewTimeoutService>(InterviewTimeoutService);
    queue = module.get<Queue>(getQueueToken('interview-timeout'));

    jest.clearAllMocks();
  });

  describe('scheduleTimeout', () => {
    it('should schedule job with 30 min delay for SHORT mode', async () => {
      const interviewId = 'test-id-1';
      const mode = InterviewMode.SHORT;

      const result = await service.scheduleTimeout(interviewId, mode);

      expect(queue.add).toHaveBeenCalledWith(
        'end-interview',
        { interviewId },
        {
          jobId: `end-interview-${interviewId}`,
          delay: 30 * 60 * 1000, // 30 minutes in ms
          removeOnComplete: true,
          removeOnFail: false,
        },
      );
      expect(result).toBeInstanceOf(Date);
    });

    it('should schedule job with 45 min delay for STANDARD mode', async () => {
      const interviewId = 'test-id-2';
      const mode = InterviewMode.STANDARD;

      await service.scheduleTimeout(interviewId, mode);

      expect(queue.add).toHaveBeenCalledWith(
        'end-interview',
        { interviewId },
        expect.objectContaining({
          delay: 45 * 60 * 1000, // 45 minutes in ms
        }),
      );
    });

    it('should schedule job with 60 min delay for LONG mode', async () => {
      const interviewId = 'test-id-3';
      const mode = InterviewMode.LONG;

      await service.scheduleTimeout(interviewId, mode);

      expect(queue.add).toHaveBeenCalledWith(
        'end-interview',
        { interviewId },
        expect.objectContaining({
          delay: 60 * 60 * 1000, // 60 minutes in ms
        }),
      );
    });
  });

  describe('cancelTimeout', () => {
    it('should cancel job if it exists', async () => {
      const interviewId = 'test-id-4';
      const mockJob = { remove: jest.fn() };
      mockQueue.getJob.mockResolvedValue(mockJob);

      const result = await service.cancelTimeout(interviewId);

      expect(queue.getJob).toHaveBeenCalledWith(`end-interview-${interviewId}`);
      expect(mockJob.remove).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('should return false if job does not exist', async () => {
      const interviewId = 'test-id-5';
      mockQueue.getJob.mockResolvedValue(null);

      const result = await service.cancelTimeout(interviewId);

      expect(result).toBe(false);
    });
  });
});
