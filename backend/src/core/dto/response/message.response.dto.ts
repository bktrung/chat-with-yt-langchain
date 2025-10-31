export class MessageResponseDto {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  createdAt: Date;
}

