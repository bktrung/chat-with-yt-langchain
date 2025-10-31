import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { Chat, chats, chatVideos, videos, messages } from '../../database/schema';
import { eq, desc, sql } from 'drizzle-orm';

export interface VideoInfo {
  id: string;
  title: string;
}

export interface ChatWithMessage {
  id: string;
  createdAt: Date;
  latestMessage: {
    id: string | null;
    content: string | null;
    role: string | null;
    createdAt: Date | null;
  } | null;
}

@Injectable()
export class ChatRepository {
  private readonly logger = new Logger(ChatRepository.name);

  constructor(private readonly db: DatabaseService) {}

  async create(): Promise<Chat> {
    const startTime = Date.now();
    
    const result = await this.db.client
      .insert(chats)
      .values({})
      .returning();

    this.logger.log(`Chat created in ${Date.now() - startTime}ms`, {
      chatId: result[0].id,
    });

    return result[0];
  }

  async addVideos(chatId: string, videoIds: string[]): Promise<void> {
    const startTime = Date.now();
    
    const values = videoIds.map((videoId) => ({ chatId, videoId }));
    await this.db.client
      .insert(chatVideos)
      .values(values);

    this.logger.debug(`Videos added to chat in ${Date.now() - startTime}ms`, {
      chatId,
      videoCount: videoIds.length,
    });
  }

  async findById(id: string): Promise<Chat | null> {
    const startTime = Date.now();
    
    const result = await this.db.client
      .select()
      .from(chats)
      .where(eq(chats.id, id))
      .limit(1);

    this.logger.debug(`findById executed in ${Date.now() - startTime}ms`, {
      chatId: id,
      found: result.length > 0,
    });

    return result[0] || null;
  }

  async updateTimestamp(id: string): Promise<void> {
    const startTime = Date.now();
    
    await this.db.client
      .update(chats)
      .set({ updatedAt: new Date() })
      .where(eq(chats.id, id));

    this.logger.debug(`Chat timestamp updated in ${Date.now() - startTime}ms`, {
      chatId: id,
    });
  }

  async getVideosByChat(chatId: string): Promise<VideoInfo[]> {
    const startTime = Date.now();
    
    const result = await this.db.client
      .select({
        id: chatVideos.videoId,
        title: videos.title,
      })
      .from(chatVideos)
      .innerJoin(videos, eq(chatVideos.videoId, videos.id))
      .where(eq(chatVideos.chatId, chatId));

    this.logger.debug(`getVideosByChat executed in ${Date.now() - startTime}ms`, {
      chatId,
      videoCount: result.length,
    });

    return result;
  }

  async findAllWithLatestMessage(): Promise<ChatWithMessage[]> {
    const startTime = Date.now();
    
    const latestMessageSubquery = this.db.client
      .select({
        id: messages.id,
        content: messages.content,
        role: messages.role,
        createdAt: messages.createdAt,
      })
      .from(messages)
      .where(eq(messages.chatId, chats.id))
      .orderBy(desc(messages.createdAt))
      .limit(1)
      .as('latestMessage');

    const result = await this.db.client
      .select({
        id: chats.id,
        createdAt: chats.createdAt,
        latestMessage: {
          id: latestMessageSubquery.id,
          content: latestMessageSubquery.content,
          role: latestMessageSubquery.role,
          createdAt: latestMessageSubquery.createdAt,
        },
      })
      .from(chats)
      .leftJoinLateral(latestMessageSubquery, sql`true`)
      .orderBy(desc(chats.updatedAt));

    this.logger.debug(`findAllWithLatestMessage executed in ${Date.now() - startTime}ms`, {
      chatCount: result.length,
    });

    return result;
  }

  async delete(id: string): Promise<void> {
    const startTime = Date.now();
    
    await this.db.client
      .delete(chats)
      .where(eq(chats.id, id));

    this.logger.log(`Chat deleted in ${Date.now() - startTime}ms`, {
      chatId: id,
    });
  }
}

