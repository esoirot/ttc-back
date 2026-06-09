import '@fastify/multipart';
import {
  Controller,
  Post,
  Delete,
  Param,
  Body,
  ParseIntPipe,
  UseGuards,
  Req,
  BadRequestException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { writeFile, mkdir } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { randomUUID } from 'node:crypto';
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
  ) {
    const data = await req.file();
    if (!data) throw new BadRequestException('No file provided');

    const ext = extname(data.filename) || '';
    const uniqueName = `${randomUUID()}${ext}`;
    const uploadDir = join(process.cwd(), 'uploads', 'tasks');
    await mkdir(uploadDir, { recursive: true });
    const buffer = await data.toBuffer();
    await writeFile(join(uploadDir, uniqueName), buffer);

    const url = `/uploads/tasks/${uniqueName}`;
    return this.attachmentsService.createFileAttachment(
      taskId,
      data.filename,
      url,
      req.user.id,
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

  @Delete(':taskId/attachments/:id')
  async deleteAttachment(@Param('id', ParseIntPipe) id: number) {
    await this.attachmentsService.delete(id);
    return { ok: true };
  }
}
