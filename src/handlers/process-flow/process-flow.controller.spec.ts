import { Test, TestingModule } from '@nestjs/testing';
import { ProcessFlowController } from './process-flow.controller';

describe('ProcessFlowController', () => {
  let controller: ProcessFlowController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProcessFlowController],
    }).compile();

    controller = module.get<ProcessFlowController>(ProcessFlowController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
