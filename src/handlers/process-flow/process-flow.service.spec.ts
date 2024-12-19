import { Test, TestingModule } from '@nestjs/testing';
import { ProcessFlowService } from './process-flow.service';

describe('ProcessFlowService', () => {
  let service: ProcessFlowService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ProcessFlowService],
    }).compile();

    service = module.get<ProcessFlowService>(ProcessFlowService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
