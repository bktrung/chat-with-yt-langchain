import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { transcriptChunks } from '../../database/schema';
import { cosineDistance, desc, inArray, sql } from 'drizzle-orm';

export interface CreateChunkData {
  videoId: string;
  title: string;
  content: string;
  embedding: number[];
}

export interface SimilarChunk {
  id: string;
  title: string;
  content: string;
  similarity: number;
}

@Injectable()
export class TranscriptRepository {
  private readonly logger = new Logger(TranscriptRepository.name);

  constructor(private readonly db: DatabaseService) {}

  async bulkCreate(chunks: CreateChunkData[]): Promise<void> {
    const startTime = Date.now();
    
    await this.db.client
      .insert(transcriptChunks)
      .values(chunks);

    this.logger.log(`${chunks.length} chunks created in ${Date.now() - startTime}ms`, {
      chunkCount: chunks.length,
      videoId: chunks[0]?.videoId,
    });
  }

  async findSimilar(
    embedding: number[],
    videoIds: string[],
    limit: number,
    threshold?: number,
  ): Promise<SimilarChunk[]> {
    const startTime = Date.now();
    
    const similarity = sql<number>`1 - (${cosineDistance(
      transcriptChunks.embedding,
      embedding,
    )})`;

    let query = this.db.client
      .select({
        id: transcriptChunks.id,
        title: transcriptChunks.title,
        content: transcriptChunks.content,
        similarity,
      })
      .from(transcriptChunks)
      .where(inArray(transcriptChunks.videoId, videoIds))
      .orderBy(desc(similarity))
      .limit(limit);

    const result = await query;

    // Filter by threshold if provided
    let filteredResult = result;
    if (threshold !== undefined) {
      filteredResult = result.filter((chunk) => chunk.similarity >= threshold);
    }

    const avgSimilarity =
      filteredResult.length > 0
        ? filteredResult.reduce((sum, chunk) => sum + chunk.similarity, 0) /
          filteredResult.length
        : 0;

    this.logger.debug(`findSimilar executed in ${Date.now() - startTime}ms`, {
      videoCount: videoIds.length,
      limit,
      threshold,
      chunksFound: filteredResult.length,
      avgSimilarity: avgSimilarity.toFixed(3),
    });

    return filteredResult;
  }
}

