import '@fastify/multipart';
import {
  Controller,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  ParseIntPipe,
  UseGuards,
  Req,
  BadRequestException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { FastifyRequest } from 'fastify';
import type { RequestUser } from '../auth/types/gql-context.type';
import { AttachmentsService } from './attachments.service';

type AuthRequest = FastifyRequest & { user: RequestUser };

@Controller('tasks')
@UseGuards(AuthGuard('jwt'))
export class AttachmentsController {
  constructor(private readonly attachmentsService: AttachmentsService) {}

  @Post(':taskId/attachments/file')
  async uploadFile(
    @Req() req: AuthRequest,
    @Param('taskId', ParseIntPipe) taskId: number,
    @Query('driver') driver?: string,
  ) {
    const data = await req.file();
    if (!data) throw new BadRequestException('No file provided');

    const buffer = await data.toBuffer();
    return this.attachmentsService.createFileAttachment(
      taskId,
      data.filename,
      buffer,
      req.user.id,
      driver,
    );
  }

  @Post(':taskId/attachments/url')
  createUrl(
    @Req() req: AuthRequest,
    @Param('taskId', ParseIntPipe) taskId: number,
    @Body() body: { url: string; displayText?: string },
  ) {
    if (!body.url?.trim()) throw new BadRequestException('url is required');
    return this.attachmentsService.createUrlAttachment(
      taskId,
      body.url.trim(),
      body.displayText?.trim() || undefined,
      req.user.id,
    );
  }

  @Patch(':taskId/attachments/:id')
  async updateAttachment(
    @Req() req: AuthRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { url: string; displayText?: string },
  ) {
    if (!body.url?.trim()) throw new BadRequestException('url is required');
    return this.attachmentsService.update(
      id,
      body.url.trim(),
      body.displayText?.trim() || undefined,
      req.user.id,
    );
  }

  @Delete(':taskId/attachments/:id')
  async deleteAttachment(
    @Req() req: AuthRequest,
    @Param('id', ParseIntPipe) id: number,
  ) {
    await this.attachmentsService.delete(id, req.user.id);
    return { ok: true };
  }
}
