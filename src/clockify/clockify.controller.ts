import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { FastifyRequest } from 'fastify';
import type { RequestUser } from '../auth/types/gql-context.type.js';
import { ClockifyService } from './clockify.service.js';
import { SetCredentialsDto } from './dto/set-credentials.dto.js';
import { StartTimeEntryDto } from './dto/start-time-entry.dto.js';
import { UpdateTimeEntryDto } from './dto/update-time-entry.dto.js';
import { ImportEntriesDto } from './dto/import-entries.dto.js';

type AuthRequest = FastifyRequest & { user: RequestUser };

@UseGuards(AuthGuard('jwt'))
@Controller('clockify')
export class ClockifyController {
  constructor(private readonly clockify: ClockifyService) {}

  @Get('status')
  getStatus(@Req() req: AuthRequest) {
    return this.clockify.getStatus(req.user.id);
  }

  @Delete('credentials')
  @HttpCode(204)
  clearCredentials(@Req() req: AuthRequest) {
    return this.clockify.clearCredentials(req.user.id);
  }

  @Post('credentials')
  @HttpCode(204)
  setCredentials(@Req() req: AuthRequest, @Body() dto: SetCredentialsDto) {
    return this.clockify.setCredentials(req.user.id, dto);
  }

  @Patch('workspace')
  @HttpCode(204)
  setWorkspace(
    @Req() req: AuthRequest,
    @Body('workspaceId') workspaceId: string,
  ) {
    return this.clockify.setWorkspace(req.user.id, workspaceId);
  }

  @Get('workspaces')
  getWorkspaces(@Req() req: AuthRequest) {
    return this.clockify.getWorkspaces(req.user.id);
  }

  @Get('workspaces/:workspaceId/projects')
  getProjects(
    @Req() req: AuthRequest,
    @Param('workspaceId') workspaceId: string,
  ) {
    return this.clockify.getProjects(req.user.id, workspaceId);
  }

  @Get('workspaces/:workspaceId/entries/active')
  getActiveEntry(
    @Req() req: AuthRequest,
    @Param('workspaceId') workspaceId: string,
  ) {
    return this.clockify.getActiveEntry(req.user.id, workspaceId);
  }

  @Get('workspaces/:workspaceId/entries')
  getEntries(
    @Req() req: AuthRequest,
    @Param('workspaceId') workspaceId: string,
    @Query('start') start?: string,
    @Query('end') end?: string,
  ) {
    return this.clockify.getEntries(req.user.id, workspaceId, start, end);
  }

  @Post('workspaces/:workspaceId/entries/import')
  importEntries(
    @Req() req: AuthRequest,
    @Param('workspaceId') workspaceId: string,
    @Body() dto: ImportEntriesDto,
  ) {
    return this.clockify.importEntries(req.user.id, workspaceId, dto);
  }

  @Post('workspaces/:workspaceId/entries')
  startEntry(
    @Req() req: AuthRequest,
    @Param('workspaceId') workspaceId: string,
    @Body() dto: StartTimeEntryDto,
  ) {
    return this.clockify.startEntry(req.user.id, workspaceId, dto);
  }

  @Patch('workspaces/:workspaceId/entries/stop')
  stopEntry(
    @Req() req: AuthRequest,
    @Param('workspaceId') workspaceId: string,
  ) {
    return this.clockify.stopEntry(req.user.id, workspaceId);
  }

  @Patch('workspaces/:workspaceId/entries/:entryId')
  updateEntry(
    @Req() req: AuthRequest,
    @Param('workspaceId') workspaceId: string,
    @Param('entryId') entryId: string,
    @Body() dto: UpdateTimeEntryDto,
  ) {
    return this.clockify.updateEntry(req.user.id, workspaceId, entryId, dto);
  }

  @Delete('workspaces/:workspaceId/entries/:entryId')
  @HttpCode(204)
  deleteEntry(
    @Req() req: AuthRequest,
    @Param('workspaceId') workspaceId: string,
    @Param('entryId') entryId: string,
  ) {
    return this.clockify.deleteEntry(req.user.id, workspaceId, entryId);
  }

  @Get('workspaces/:workspaceId/tags')
  getTags(@Req() req: AuthRequest, @Param('workspaceId') workspaceId: string) {
    return this.clockify.getTags(req.user.id, workspaceId);
  }

  @Post('workspaces/:workspaceId/tags')
  createTag(
    @Req() req: AuthRequest,
    @Param('workspaceId') workspaceId: string,
    @Body('name') name: string,
  ) {
    return this.clockify.createTag(req.user.id, workspaceId, name);
  }
}
