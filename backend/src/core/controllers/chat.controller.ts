import { Controller, Post, Body, Query, Get, Inject, HttpCode, HttpStatus, Res, Delete } from '@nestjs/common';
import { Response } from 'express';
import { ChatService } from '../services/chat.service';
import { CreateChatDto } from '../dto/request/create-chat.dto';
import { AskQuestionDto } from '../dto/request/ask-question.dto';
import { GetMessagesDto } from '../dto/request/get-messages.dto';
import { ChatResponseDto } from '../dto/response/chat.response.dto';
import { MessageResponseDto } from '../dto/response/message.response.dto';
import { AskResponseDto } from '../dto/response/ask-response.dto';
import { DeleteChatDto } from '../dto/request/delete-chat.dto';

@Controller('chat')
export class ChatController {
  @Inject(ChatService)
  private readonly chatService: ChatService;

  @Post('create')
  @HttpCode(HttpStatus.CREATED)
  async createChat(@Body() dto: CreateChatDto): Promise<{ id: string }> {
    return await this.chatService.createChat(dto.videoIds);
  }

  @Post('ask')
  @HttpCode(HttpStatus.OK)
  async ask(@Body() dto: AskQuestionDto): Promise<AskResponseDto> {
    return await this.chatService.ask(dto.chatId, dto.question);
  }

  @Post('ask-stream')
  @HttpCode(HttpStatus.OK)
  async askStream(@Body() dto: AskQuestionDto, @Res() res: Response): Promise<void> {
    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

    const stream = this.chatService.askStreaming(dto.chatId, dto.question);

    stream.subscribe({
      next: (event) => {
        res.write(`data: ${event.data}\n\n`);
      },
      error: (error) => {
        res.write(`data: ${JSON.stringify({ type: 'error', data: error.message })}\n\n`);
        res.end();
      },
      complete: () => {
        res.end();
      },
    });

    // Handle client disconnect
    res.on('close', () => {
      stream.subscribe().unsubscribe();
    });
  }

  @Get('messages')
  @HttpCode(HttpStatus.OK)
  async getMessages(@Query() dto: GetMessagesDto): Promise<MessageResponseDto[]> {
    return await this.chatService.getChatMessages(dto.chatId);
  }

  @Get('chats')
  @HttpCode(HttpStatus.OK)
  async getChats(): Promise<ChatResponseDto[]> {
    return await this.chatService.getChats();
  }

  @Delete()
  @HttpCode(HttpStatus.OK)
  async deleteChat(@Query() dto: DeleteChatDto): Promise<void> {
    return await this.chatService.deleteChat(dto.chatId);
  }
}
