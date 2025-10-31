import { Inject, Injectable, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';
import { EmbeddingService } from './embedding.service';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { PromptService } from './promt.service';
import { ChatRepository } from '../repositories/chat.repository';
import { MessageRepository } from '../repositories/message.repository';
import { TranscriptRepository } from '../repositories/transcript.repository';
import { ChatNotFoundException } from '../../common/exceptions/chat-not-found.exception';
import { MessageResponseDto } from '../dto/response/message.response.dto';
import { ChatResponseDto } from '../dto/response/chat.response.dto';
import { AskResponseDto } from '../dto/response/ask-response.dto';
import { RAG_CONFIG } from '../../config/rag.config';

export interface MessageEvent {
  data: string | object;
}

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  @Inject(EmbeddingService)
  private readonly embeddingService: EmbeddingService;

  @Inject(ChatRepository)
  private readonly chatRepository: ChatRepository;

  @Inject(MessageRepository)
  private readonly messageRepository: MessageRepository;

  @Inject(TranscriptRepository)
  private readonly transcriptRepository: TranscriptRepository;

  @Inject(PromptService)
  private readonly promptService: PromptService;

  private llm: ChatGoogleGenerativeAI;

  constructor() {
    this.llm = new ChatGoogleGenerativeAI({
      model: RAG_CONFIG.model,
      apiKey: process.env.GEMINI_API_KEY,
      temperature: RAG_CONFIG.temperature,
    });
  }

  async createChat(videoIds: string[]): Promise<{ id: string }> {
    this.logger.log('Creating new chat', { videoCount: videoIds.length });
    
    const chat = await this.chatRepository.create();
    await this.chatRepository.addVideos(chat.id, videoIds);

    this.logger.log('Chat created successfully', { chatId: chat.id });
    return { id: chat.id };
  }

  async ask(chatId: string, question: string): Promise<AskResponseDto> {
    this.logger.log('Processing question', { chatId, questionLength: question.length });
    const startTime = Date.now();

    // Verify chat exists
    const chat = await this.chatRepository.findById(chatId);
    if (!chat) {
      throw new ChatNotFoundException(chatId);
    }

    // 1. Embed question
    const embeddingStartTime = Date.now();
    const questionEmbedding = await this.embeddingService.embedQuery(question);
    const vectorEmbedding = this.embeddingService.asVector(questionEmbedding);
    this.logger.debug(`Question embedded in ${Date.now() - embeddingStartTime}ms`);

    // 2. Get chat videos
    const videos = await this.chatRepository.getVideosByChat(chatId);

    // 3. Retrieve similar chunks with optimized parameters
    const similarChunks = await this.transcriptRepository.findSimilar(
      vectorEmbedding,
      videos.map((v) => v.id),
      RAG_CONFIG.maxChunks,
      RAG_CONFIG.similarityThreshold,
    );

    // Ensure minimum chunks if threshold filtering was too aggressive
    let finalChunks = similarChunks;
    if (similarChunks.length < RAG_CONFIG.minChunks) {
      this.logger.warn(
        `Only ${similarChunks.length} chunks above threshold, retrieving top ${RAG_CONFIG.minChunks}`,
      );
      finalChunks = await this.transcriptRepository.findSimilar(
        vectorEmbedding,
        videos.map((v) => v.id),
        RAG_CONFIG.minChunks,
      );
    }

    // 4. Get chat message history (optimized to 50 messages)
    const messages = await this.messageRepository.findByChatId(
      chatId,
      RAG_CONFIG.maxMessages,
    );

    // Reverse to get chronological order (oldest first)
    messages.reverse();

    // 5. Build prompt
    const titles = videos.map((video) => video.title);
    const prompt = this.promptService.buildPrompt(finalChunks, titles, messages, question);

    // 6. Generate answer using LLM
    this.logger.log('Invoking LLM', { chunkCount: finalChunks.length, messageCount: messages.length });
    const llmStartTime = Date.now();
    const response = await this.llm.invoke(prompt);
    this.logger.log(`LLM response received in ${Date.now() - llmStartTime}ms`);

    const answerContent =
      typeof response.content === 'string'
        ? response.content
        : JSON.stringify(response.content);

    // 7. Save user question and assistant response to messages table
    await this.messageRepository.create({
      chatId,
      content: question,
      role: 'user',
    });

    await this.messageRepository.create({
      chatId,
      content: answerContent,
      role: 'assistant',
    });

    await this.chatRepository.updateTimestamp(chatId);

    const totalTime = Date.now() - startTime;
    this.logger.log(`Question processed successfully in ${totalTime}ms`, {
      chatId,
      totalTime,
      chunksUsed: finalChunks.length,
    });

    // 8. Return answer with chunk metadata
    return {
      answer: answerContent,
      chunks: finalChunks.map((chunk) => ({
        content: chunk.content.slice(0, 100) + '...',
        similarity: chunk.similarity,
      })),
    };
  }

  askStreaming(chatId: string, question: string): Observable<MessageEvent> {
    return new Observable((subscriber) => {
      (async () => {
        try {
          this.logger.log('Processing streaming question', { chatId, questionLength: question.length });
          const startTime = Date.now();

          // Verify chat exists
          const chat = await this.chatRepository.findById(chatId);
          if (!chat) {
            subscriber.error(new ChatNotFoundException(chatId));
            return;
          }

          // 1. Embed question
          const questionEmbedding = await this.embeddingService.embedQuery(question);
          const vectorEmbedding = this.embeddingService.asVector(questionEmbedding);

          // 2. Get chat videos
          const videos = await this.chatRepository.getVideosByChat(chatId);

          // 3. Retrieve similar chunks
          const similarChunks = await this.transcriptRepository.findSimilar(
            vectorEmbedding,
            videos.map((v) => v.id),
            RAG_CONFIG.maxChunks,
            RAG_CONFIG.similarityThreshold,
          );

          let finalChunks = similarChunks;
          if (similarChunks.length < RAG_CONFIG.minChunks) {
            finalChunks = await this.transcriptRepository.findSimilar(
              vectorEmbedding,
              videos.map((v) => v.id),
              RAG_CONFIG.minChunks,
            );
          }

          // 4. Get chat message history
          const messages = await this.messageRepository.findByChatId(
            chatId,
            RAG_CONFIG.maxMessages,
          );
          messages.reverse();

          // 5. Build prompt
          const titles = videos.map((video) => video.title);
          const prompt = this.promptService.buildPrompt(finalChunks, titles, messages, question);

          // 6. Stream LLM response
          this.logger.log('Starting LLM streaming', { chunkCount: finalChunks.length });
          const stream = await this.llm.stream(prompt);

          let fullAnswer = '';

          for await (const chunk of stream) {
            const content = chunk.content;
            if (content) {
              const text = typeof content === 'string' ? content : JSON.stringify(content);
              fullAnswer += text;
              
              // Emit token event
              subscriber.next({
                data: JSON.stringify({ type: 'token', data: text }),
              });
            }
          }

          // 7. Save messages to database
          await this.messageRepository.create({
            chatId,
            content: question,
            role: 'user',
          });

          await this.messageRepository.create({
            chatId,
            content: fullAnswer,
            role: 'assistant',
          });

          await this.chatRepository.updateTimestamp(chatId);

          // 8. Emit completion event with metadata
          subscriber.next({
            data: JSON.stringify({
              type: 'done',
              data: {
                answer: fullAnswer,
                chunks: finalChunks.map((chunk) => ({
                  content: chunk.content.slice(0, 100) + '...',
                  similarity: chunk.similarity,
                })),
              },
            }),
          });

          const totalTime = Date.now() - startTime;
          this.logger.log(`Streaming completed successfully in ${totalTime}ms`, {
            chatId,
            totalTime,
            answerLength: fullAnswer.length,
          });

          subscriber.complete();
        } catch (error) {
          this.logger.error('Error in streaming', error);
          subscriber.error(error);
        }
      })();
    });
  }

  async getChatMessages(chatId: string): Promise<MessageResponseDto[]> {
    this.logger.debug('Fetching chat messages', { chatId });
    
    // Verify chat exists
    const chat = await this.chatRepository.findById(chatId);
    if (!chat) {
      throw new ChatNotFoundException(chatId);
    }

    const messages = await this.messageRepository.findByChatId(chatId);
    return messages;
  }

  async getChats(): Promise<ChatResponseDto[]> {
    this.logger.debug('Fetching all chats');
    const chats = await this.chatRepository.findAllWithLatestMessage();
    
    // Map to proper DTO format
    return chats.map((chat) => ({
      id: chat.id,
      createdAt: chat.createdAt,
      latestMessage: chat.latestMessage?.id
        ? {
            id: chat.latestMessage.id,
            content: chat.latestMessage.content!,
            role: chat.latestMessage.role as 'user' | 'assistant',
            createdAt: chat.latestMessage.createdAt!,
          }
        : undefined,
    }));
  }

  async deleteChat(chatId: string): Promise<void> {
    this.logger.log('Deleting chat', { chatId });
    
    // Verify chat exists
    const chat = await this.chatRepository.findById(chatId);
    if (!chat) {
      throw new ChatNotFoundException(chatId);
    }

    await this.chatRepository.delete(chatId);
    this.logger.log('Chat deleted successfully', { chatId });
  }
}