import { NotFoundException } from '@nestjs/common';

export class VideoNotFoundException extends NotFoundException {
  constructor(id: string) {
    super(`Video with ID "${id}" not found`);
  }
}

