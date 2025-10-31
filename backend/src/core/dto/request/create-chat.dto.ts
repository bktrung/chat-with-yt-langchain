import { IsArray, IsNotEmpty, IsUUID, ArrayMinSize } from 'class-validator';

export class CreateChatDto {
  @IsArray({ message: 'videoIds must be an array' })
  @ArrayMinSize(1, { message: 'At least one video ID is required' })
  @IsUUID('4', { each: true, message: 'Each videoId must be a valid UUID' })
  @IsNotEmpty({ message: 'videoIds cannot be empty' })
  videoIds: string[];
}

