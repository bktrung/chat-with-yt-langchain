import { IsNotEmpty, IsUUID } from 'class-validator';

export class GetMessagesDto {
  @IsUUID('4', { message: 'chatId must be a valid UUID' })
  @IsNotEmpty({ message: 'chatId is required' })
  chatId: string;
}

