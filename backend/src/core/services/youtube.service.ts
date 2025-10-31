import { Inject, Injectable, Logger } from '@nestjs/common';
import { YoutubeLoader } from '@langchain/community/document_loaders/web/youtube';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { EmbeddingService } from './embedding.service';
import { VideoRepository } from '../repositories/video.repository';
import { TranscriptRepository } from '../repositories/transcript.repository';
import { VideoAlreadyExistsException } from '../../common/exceptions/video-already-exists.exception';
import { InvalidYoutubeUrlException } from '../../common/exceptions/invalid-youtube-url.exception';
import { VideoResponseDto } from '../dto/response/video.response.dto';
import { RAG_CONFIG } from '../../config/rag.config';

@Injectable()
export class YoutubeService {
  private readonly logger = new Logger(YoutubeService.name);

  @Inject(VideoRepository)
  private readonly videoRepository: VideoRepository;

  @Inject(TranscriptRepository)
  private readonly transcriptRepository: TranscriptRepository;

  @Inject(EmbeddingService)
  private readonly embeddingService: EmbeddingService;

  async importFromUrl(url: string): Promise<{ id: string; message: string }> {
    this.logger.log(`Starting video import from URL: ${url}`);
    const startTime = Date.now();

    let loader: YoutubeLoader;
    try {
      loader = YoutubeLoader.createFromUrl(url, {
        addVideoInfo: true,
      });
    } catch (error) {
      this.logger.error(`Failed to create YouTube loader for URL: ${url}`, error);
      throw new InvalidYoutubeUrlException(url);
    }

    const docs = await loader.load();
    
    if (!docs || docs.length === 0) {
      throw new InvalidYoutubeUrlException(url);
    }

    const youtubeId = docs[0].metadata.source;
    const existingVideo = await this.videoRepository.findByYoutubeId(youtubeId);

    if (existingVideo) {
      throw new VideoAlreadyExistsException(youtubeId);
    }

    // Create video record
    const video = await this.videoRepository.create({
      url,
      youtubeId: docs[0].metadata.source,
      title: docs[0].metadata.title,
      description: docs[0].metadata.description || 'No description available',
    });

    // Enhance content with title
    docs[0].pageContent = `Title: ${docs[0].metadata.title} | Content: ${docs[0].pageContent}`;

    // Split into chunks
    this.logger.log(`Splitting transcript into chunks for video: ${video.id}`);
    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: RAG_CONFIG.chunkSize,
      chunkOverlap: RAG_CONFIG.chunkOverlap,
    });

    const chunks = await textSplitter.splitDocuments(docs);
    this.logger.log(`Created ${chunks.length} chunks for video: ${video.id}`);

    // Generate embeddings
    this.logger.log(`Generating embeddings for ${chunks.length} chunks`);
    const embeddingStartTime = Date.now();
    const embeddings = await this.embeddingService.embedDocs(
      chunks.map((chunk) => chunk.pageContent),
    );
    this.logger.log(`Embeddings generated in ${Date.now() - embeddingStartTime}ms`);

    // Prepare chunk data
    const chunksData = chunks.map((chunk, index) => ({
      videoId: video.id,
      title: chunk.metadata.title,
      content: chunk.pageContent,
      embedding: this.embeddingService.asVector(embeddings[index]),
    }));

    // Save chunks
    await this.transcriptRepository.bulkCreate(chunksData);

    const totalTime = Date.now() - startTime;
    this.logger.log(
      `Video import completed successfully in ${totalTime}ms`,
      {
        videoId: video.id,
        youtubeId,
        chunkCount: chunks.length,
        totalTime,
      },
    );

    return {
      id: video.id,
      message: 'Video imported successfully',
    };
  }

  async getVideos(): Promise<VideoResponseDto[]> {
    this.logger.debug('Fetching all videos');
    return await this.videoRepository.findAll();
  }

  async deleteVideo(videoId: string): Promise<void> {
    this.logger.log('Deleting video', { videoId });
    
    // Verify video exists
    const video = await this.videoRepository.findById(videoId);
    if (!video) {
      throw new InvalidYoutubeUrlException(`Video with ID ${videoId} not found`);
    }

    await this.videoRepository.delete(videoId);
    this.logger.log('Video deleted successfully', { videoId, title: video.title });
  }
}