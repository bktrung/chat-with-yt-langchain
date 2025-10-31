import { Controller, Post, Body, Get, Inject, HttpCode, HttpStatus, Delete, Query } from '@nestjs/common';
import { YoutubeService } from '../services/youtube.service';
import { ImportVideoDto } from '../dto/request/import-video.dto';
import { DeleteVideoDto } from '../dto/request/delete-video.dto';
import { VideoResponseDto } from '../dto/response/video.response.dto';

@Controller('youtube')
export class YoutubeController {
  @Inject(YoutubeService)
  private readonly youtubeService: YoutubeService;

  @Post('import')
  @HttpCode(HttpStatus.CREATED)
  async import(@Body() dto: ImportVideoDto): Promise<{ id: string; message: string }> {
    return await this.youtubeService.importFromUrl(dto.url);
  }

  @Get('videos')
  @HttpCode(HttpStatus.OK)
  async getVideos(): Promise<VideoResponseDto[]> {
    return await this.youtubeService.getVideos();
  }

  @Delete('video')
  @HttpCode(HttpStatus.OK)
  async deleteVideo(@Query() dto: DeleteVideoDto): Promise<{ message: string }> {
    await this.youtubeService.deleteVideo(dto.videoId);
    return { message: 'Video deleted successfully' };
  }
}
