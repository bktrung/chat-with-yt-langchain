import { BadRequestException } from '@nestjs/common';

export class InvalidYoutubeUrlException extends BadRequestException {
  constructor(url: string) {
    super(`Invalid YouTube URL: "${url}"`);
  }
}

