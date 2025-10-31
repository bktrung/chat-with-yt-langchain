import { IsNotEmpty, IsUrl, IsString, MaxLength } from 'class-validator';

export class ImportVideoDto {
  @IsString()
  @IsNotEmpty()
  @IsUrl({}, { message: 'Invalid URL format' })
  @MaxLength(2048, { message: 'URL must not exceed 2048 characters' })
  url: string;
}

