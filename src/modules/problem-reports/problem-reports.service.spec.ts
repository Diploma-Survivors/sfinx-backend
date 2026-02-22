import { Test, TestingModule } from '@nestjs/testing';
import { ProblemReportsService } from './problem-reports.service';

describe('ProblemReportsService', () => {
  let service: ProblemReportsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ProblemReportsService],
    }).compile();

    service = module.get<ProblemReportsService>(ProblemReportsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
