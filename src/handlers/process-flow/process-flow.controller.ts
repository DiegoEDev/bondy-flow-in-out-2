import { Controller, Get } from '@nestjs/common';
import { ProcessFlowService } from './process-flow.service';

@Controller('process-flow')
export class ProcessFlowController {
    constructor(private readonly processFlowService: ProcessFlowService) {}
    
    @Get(':id')
    async getProcessFlowById(id: string) {
        return await this.processFlowService.getProcessFlowById(id);
    }
}
