import { Test, TestingModule } from '@nestjs/testing';
import { ProblemReportsController } from './problem-reports.controller';

describe('ProblemReportsController', () => {
  let controller: ProblemReportsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProblemReportsController],
    }).compile();

    controller = module.get<ProblemReportsController>(ProblemReportsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
