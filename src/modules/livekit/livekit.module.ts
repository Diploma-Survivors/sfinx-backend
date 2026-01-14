import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LiveKitController } from './livekit.controller';
import { LiveKitService } from './livekit.service';
import { AiInterviewsModule } from '../ai-interviews/ai-interviews.module';
import { livekitConfig } from 'src/config/livekit.config';

@Module({
  imports: [ConfigModule.forFeature(livekitConfig), AiInterviewsModule],
  controllers: [LiveKitController],
  providers: [LiveKitService],
  exports: [LiveKitService],
})
export class LiveKitModule {}
