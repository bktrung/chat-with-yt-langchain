import { IsNotEmpty, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class AskQuestionDto {
  @IsUUID('4', { message: 'chatId must be a valid UUID' })
  @IsNotEmpty({ message: 'chatId is required' })
  chatId: string;

  @IsString({ message: 'question must be a string' })
  @IsNotEmpty({ message: 'question cannot be empty' })
  @MinLength(1, { message: 'question must have at least 1 character' })
  @MaxLength(5000, { message: 'question must not exceed 5000 characters' })
  question: string;
}

