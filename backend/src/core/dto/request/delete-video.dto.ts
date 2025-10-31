import { IsNotEmpty, IsUUID } from 'class-validator';

export class DeleteVideoDto {
  @IsUUID('4', { message: 'videoId must be a valid UUID' })
  @IsNotEmpty({ message: 'videoId is required' })
  videoId: string;
}

