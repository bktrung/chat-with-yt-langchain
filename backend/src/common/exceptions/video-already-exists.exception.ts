import { ConflictException } from '@nestjs/common';

export class VideoAlreadyExistsException extends ConflictException {
  constructor(youtubeId: string) {
    super(`Video with YouTube ID "${youtubeId}" has already been imported`);
  }
}

