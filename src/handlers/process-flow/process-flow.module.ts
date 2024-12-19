import { Module } from '@nestjs/common';
import { ProcessFlowService } from './process-flow.service';
import { ProcessFlowController } from './process-flow.controller';

@Module({
  providers: [ProcessFlowService],
  controllers: [ProcessFlowController]
})
export class ProcessFlowModule {}
