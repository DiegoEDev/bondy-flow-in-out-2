import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ProcessFlowModule } from './handlers/process-flow/process-flow.module';

@Module({
  imports: [ProcessFlowModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
