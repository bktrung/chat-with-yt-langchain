import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { Message, messages } from '../../database/schema';
import { eq, desc } from 'drizzle-orm';

export interface CreateMessageData {
  chatId: string;
  content: string;
  role: 'user' | 'assistant';
}

@Injectable()
export class MessageRepository {
  private readonly logger = new Logger(MessageRepository.name);

  constructor(private readonly db: DatabaseService) {}

  async create(data: CreateMessageData): Promise<Message> {
    const startTime = Date.now();
    
    const result = await this.db.client
      .insert(messages)
      .values(data)
      .returning();

    this.logger.debug(`Message created in ${Date.now() - startTime}ms`, {
      messageId: result[0].id,
      chatId: data.chatId,
      role: data.role,
    });

    return result[0];
  }

  async findByChatId(chatId: string, limit?: number): Promise<Message[]> {
    const startTime = Date.now();
    
    let query = this.db.client
      .select()
      .from(messages)
      .where(eq(messages.chatId, chatId))
      .orderBy(desc(messages.createdAt));

    if (limit) {
      query = query.limit(limit) as any;
    }

    const result = await query;

    this.logger.debug(`findByChatId executed in ${Date.now() - startTime}ms`, {
      chatId,
      limit,
      messageCount: result.length,
    });

    return result;
  }
}

