import { MessageResponseDto } from './message.response.dto';

export class ChatResponseDto {
  id: string;
  createdAt: Date;
  latestMessage?: MessageResponseDto | null;
}

