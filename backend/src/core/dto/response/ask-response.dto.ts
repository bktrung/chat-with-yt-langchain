export class ChunkMetadataDto {
  content: string;
  similarity: number;
}

export class AskResponseDto {
  answer: string;
  chunks: ChunkMetadataDto[];
}

