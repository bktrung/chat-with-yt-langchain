import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { Video, videos } from '../../database/schema';
import { eq } from 'drizzle-orm';

export interface CreateVideoData {
  url: string;
  youtubeId: string;
  title: string;
  description: string;
}

@Injectable()
export class VideoRepository {
  private readonly logger = new Logger(VideoRepository.name);

  constructor(private readonly db: DatabaseService) {}

  async findByYoutubeId(youtubeId: string): Promise<Video | null> {
    const startTime = Date.now();
    
    const result = await this.db.client
      .select()
      .from(videos)
      .where(eq(videos.youtubeId, youtubeId))
      .limit(1);

    this.logger.debug(`findByYoutubeId executed in ${Date.now() - startTime}ms`, {
      youtubeId,
      found: result.length > 0,
    });

    return result[0] || null;
  }

  async create(data: CreateVideoData): Promise<Video> {
    const startTime = Date.now();
    
    const result = await this.db.client
      .insert(videos)
      .values(data)
      .returning();

    this.logger.log(`Video created in ${Date.now() - startTime}ms`, {
      videoId: result[0].id,
      youtubeId: data.youtubeId,
      title: data.title,
    });

    return result[0];
  }

  async findAll(): Promise<Video[]> {
    const startTime = Date.now();
    
    const result = await this.db.client
      .select()
      .from(videos);

    this.logger.debug(`findAll executed in ${Date.now() - startTime}ms`, {
      count: result.length,
    });

    return result;
  }

  async findById(id: string): Promise<Video | null> {
    const startTime = Date.now();
    
    const result = await this.db.client
      .select()
      .from(videos)
      .where(eq(videos.id, id))
      .limit(1);

    this.logger.debug(`findById executed in ${Date.now() - startTime}ms`, {
      videoId: id,
      found: result.length > 0,
    });

    return result[0] || null;
  }

  async delete(id: string): Promise<void> {
    const startTime = Date.now();
    
    await this.db.client
      .delete(videos)
      .where(eq(videos.id, id));

    this.logger.log(`Video deleted in ${Date.now() - startTime}ms`, {
      videoId: id,
    });
  }
}

