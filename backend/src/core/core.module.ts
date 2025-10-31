import { Module } from '@nestjs/common';
import { YoutubeController } from './controllers/youtube.controller';
import { ChatController } from './controllers/chat.controller';
import { YoutubeService } from './services/youtube.service';
import { EmbeddingService } from './services/embedding.service';
import { ChatService } from './services/chat.service';
import { PromptService } from './services/promt.service';
import { DatabaseModule } from '../database/database.module';
import { VideoRepository } from './repositories/video.repository';
import { ChatRepository } from './repositories/chat.repository';
import { MessageRepository } from './repositories/message.repository';
import { TranscriptRepository } from './repositories/transcript.repository';

@Module({
  imports: [DatabaseModule],
  controllers: [YoutubeController, ChatController],
  providers: [
    YoutubeService,
    EmbeddingService,
    ChatService,
    PromptService,
    VideoRepository,
    ChatRepository,
    MessageRepository,
    TranscriptRepository,
  ],
})
export class CoreModule {}

