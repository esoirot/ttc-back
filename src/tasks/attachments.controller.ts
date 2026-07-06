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
import {
  ApiBody,
  ApiConsumes,
  ApiCookieAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import type { FastifyRequest } from 'fastify';
import type { RequestUser } from '../auth/types/gql-context.type';
import { AttachmentsService } from './attachments.service';

type AuthRequest = FastifyRequest & { user: RequestUser };

@ApiTags('attachments')
@ApiCookieAuth('access_token')
@Controller('tasks')
@UseGuards(AuthGuard('jwt'))
export class AttachmentsController {
  constructor(private readonly attachmentsService: AttachmentsService) {}

  @Post(':taskId/attachments/file')
  @ApiOperation({ summary: 'Upload a file attachment to a task' })
  @ApiParam({ name: 'taskId', type: Number })
  @ApiQuery({
    name: 'driver',
    required: false,
    description: 'Storage driver override (defaults to STORAGE_DRIVER env)',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
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
  @ApiOperation({ summary: 'Attach a URL (link) to a task' })
  @ApiParam({ name: 'taskId', type: Number })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['url'],
      properties: {
        url: { type: 'string' },
        displayText: { type: 'string' },
      },
    },
  })
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
  @ApiOperation({ summary: 'Update a URL attachment' })
  @ApiParam({ name: 'taskId', type: Number })
  @ApiParam({ name: 'id', type: Number })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['url'],
      properties: {
        url: { type: 'string' },
        displayText: { type: 'string' },
      },
    },
  })
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
  @ApiOperation({ summary: 'Delete a task attachment' })
  @ApiParam({ name: 'taskId', type: Number })
  @ApiParam({ name: 'id', type: Number })
  async deleteAttachment(
    @Req() req: AuthRequest,
    @Param('id', ParseIntPipe) id: number,
  ) {
    await this.attachmentsService.delete(id, req.user.id);
    return { ok: true };
  }
}
