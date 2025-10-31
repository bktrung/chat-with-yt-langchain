import { NotFoundException } from '@nestjs/common';

export class ChatNotFoundException extends NotFoundException {
  constructor(chatId: string) {
    super(`Chat with ID "${chatId}" not found`);
  }
}

