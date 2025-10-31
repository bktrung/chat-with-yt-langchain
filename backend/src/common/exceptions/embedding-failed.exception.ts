import { InternalServerErrorException } from '@nestjs/common';

export class EmbeddingFailedException extends InternalServerErrorException {
  constructor(message?: string) {
    super(message || 'Failed to generate embeddings');
  }
}

