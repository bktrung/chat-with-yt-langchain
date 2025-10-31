import { Injectable, Logger } from '@nestjs/common';
import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';
import { EmbeddingFailedException } from '../../common/exceptions/embedding-failed.exception';

@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);
  private readonly dimension: number;
  private embeddingClient: GoogleGenerativeAIEmbeddings;

  constructor() {
    this.dimension = Number(process.env.EMBEDDING_DIMENSION);
    this.logger.log(`EmbeddingService initialized with dimension: ${this.dimension}`);
  }

  private get embedding(): GoogleGenerativeAIEmbeddings {
    if (!this.embeddingClient) {
      this.embeddingClient = new GoogleGenerativeAIEmbeddings({
        model: process.env.GEMINI_EMBEDDING_MODEL,
        apiKey: process.env.GEMINI_API_KEY,
      });
    }
    return this.embeddingClient;
  }

  get vectorDimension(): number {
    return this.dimension;
  }

  async embedDocs(texts: string[]): Promise<number[][]> {
    const startTime = Date.now();
    try {
      const embeddings = await this.embedding.embedDocuments(texts);
      this.logger.debug(
        `Embedded ${texts.length} documents in ${Date.now() - startTime}ms`,
      );
      return embeddings;
    } catch (error) {
      this.logger.error('Failed to embed documents', error);
      throw new EmbeddingFailedException('Failed to generate document embeddings');
    }
  }

  async embedQuery(text: string): Promise<number[]> {
    const startTime = Date.now();
    try {
      const embedding = await this.embedding.embedQuery(text);
      this.logger.debug(`Embedded query in ${Date.now() - startTime}ms`);
      return embedding;
    } catch (error) {
      this.logger.error('Failed to embed query', error);
      throw new EmbeddingFailedException('Failed to generate query embedding');
    }
  }

  asVector(values: number[]): number[] {
    return this.sanitize(values);
  }

  private sanitize(values: number[]): number[] {
    if (values.length !== this.dimension) {
      this.logger.warn(
        `Embedding dimension mismatch: expected ${this.dimension}, got ${values.length}`,
      );
    }
    return values.map((value) => {
      if (!Number.isFinite(value)) {
        return 0;
      }
      return Number(Number(value).toFixed(6));
    });
  }
}
