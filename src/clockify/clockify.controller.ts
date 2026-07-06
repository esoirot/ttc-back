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
import {
  ApiBody,
  ApiCookieAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import type { FastifyRequest } from 'fastify';
import type { RequestUser } from '../auth/types/gql-context.type.js';
import { ClockifyService } from './clockify.service.js';
import { SetCredentialsDto } from './dto/set-credentials.dto.js';
import { StartTimeEntryDto } from './dto/start-time-entry.dto.js';
import { UpdateTimeEntryDto } from './dto/update-time-entry.dto.js';
import { ImportEntriesDto } from './dto/import-entries.dto.js';

type AuthRequest = FastifyRequest & { user: RequestUser };

@ApiTags('clockify')
@ApiCookieAuth('access_token')
@UseGuards(AuthGuard('jwt'))
@Controller('clockify')
export class ClockifyController {
  constructor(private readonly clockify: ClockifyService) {}

  @Get('status')
  @ApiOperation({ summary: 'Connection status — credentials + workspace' })
  getStatus(@Req() req: AuthRequest) {
    return this.clockify.getStatus(req.user.id);
  }

  @Delete('credentials')
  @HttpCode(204)
  @ApiOperation({ summary: 'Disconnect — clear stored Clockify credentials' })
  clearCredentials(@Req() req: AuthRequest) {
    return this.clockify.clearCredentials(req.user.id);
  }

  @Post('credentials')
  @HttpCode(204)
  @ApiOperation({ summary: 'Set Clockify API key (encrypted at rest)' })
  setCredentials(@Req() req: AuthRequest, @Body() dto: SetCredentialsDto) {
    return this.clockify.setCredentials(req.user.id, dto);
  }

  @Patch('workspace')
  @HttpCode(204)
  @ApiOperation({ summary: 'Select the active Clockify workspace' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['workspaceId'],
      properties: { workspaceId: { type: 'string' } },
    },
  })
  setWorkspace(
    @Req() req: AuthRequest,
    @Body('workspaceId') workspaceId: string,
  ) {
    return this.clockify.setWorkspace(req.user.id, workspaceId);
  }

  @Get('workspaces')
  @ApiOperation({ summary: 'List Clockify workspaces for stored credentials' })
  getWorkspaces(@Req() req: AuthRequest) {
    return this.clockify.getWorkspaces(req.user.id);
  }

  @Get('workspaces/:workspaceId/projects')
  @ApiOperation({ summary: 'List projects in a workspace' })
  @ApiParam({ name: 'workspaceId' })
  getProjects(
    @Req() req: AuthRequest,
    @Param('workspaceId') workspaceId: string,
  ) {
    return this.clockify.getProjects(req.user.id, workspaceId);
  }

  @Get('workspaces/:workspaceId/entries/active')
  @ApiOperation({ summary: 'Get the currently running time entry, if any' })
  @ApiParam({ name: 'workspaceId' })
  getActiveEntry(
    @Req() req: AuthRequest,
    @Param('workspaceId') workspaceId: string,
  ) {
    return this.clockify.getActiveEntry(req.user.id, workspaceId);
  }

  @Get('workspaces/:workspaceId/entries')
  @ApiOperation({ summary: 'List time entries in a date range' })
  @ApiParam({ name: 'workspaceId' })
  @ApiQuery({ name: 'start', required: false, description: 'ISO date' })
  @ApiQuery({ name: 'end', required: false, description: 'ISO date' })
  getEntries(
    @Req() req: AuthRequest,
    @Param('workspaceId') workspaceId: string,
    @Query('start') start?: string,
    @Query('end') end?: string,
  ) {
    return this.clockify.getEntries(req.user.id, workspaceId, start, end);
  }

  @Post('workspaces/:workspaceId/entries/import')
  @ApiOperation({
    summary:
      'Import Clockify entries into TTC time entries (dedup by clockifyEntryId)',
  })
  @ApiParam({ name: 'workspaceId' })
  importEntries(
    @Req() req: AuthRequest,
    @Param('workspaceId') workspaceId: string,
    @Body() dto: ImportEntriesDto,
  ) {
    return this.clockify.importEntries(req.user.id, workspaceId, dto);
  }

  @Post('workspaces/:workspaceId/entries')
  @ApiOperation({ summary: 'Start a new (running) time entry' })
  @ApiParam({ name: 'workspaceId' })
  startEntry(
    @Req() req: AuthRequest,
    @Param('workspaceId') workspaceId: string,
    @Body() dto: StartTimeEntryDto,
  ) {
    return this.clockify.startEntry(req.user.id, workspaceId, dto);
  }

  @Patch('workspaces/:workspaceId/entries/stop')
  @ApiOperation({ summary: 'Stop the currently running time entry' })
  @ApiParam({ name: 'workspaceId' })
  stopEntry(
    @Req() req: AuthRequest,
    @Param('workspaceId') workspaceId: string,
  ) {
    return this.clockify.stopEntry(req.user.id, workspaceId);
  }

  @Patch('workspaces/:workspaceId/entries/:entryId')
  @ApiOperation({ summary: 'Update (full replace) a time entry' })
  @ApiParam({ name: 'workspaceId' })
  @ApiParam({ name: 'entryId' })
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
  @ApiOperation({ summary: 'Delete a time entry' })
  @ApiParam({ name: 'workspaceId' })
  @ApiParam({ name: 'entryId' })
  deleteEntry(
    @Req() req: AuthRequest,
    @Param('workspaceId') workspaceId: string,
    @Param('entryId') entryId: string,
  ) {
    return this.clockify.deleteEntry(req.user.id, workspaceId, entryId);
  }

  @Get('workspaces/:workspaceId/tags')
  @ApiOperation({ summary: 'List tags defined in a workspace' })
  @ApiParam({ name: 'workspaceId' })
  getTags(@Req() req: AuthRequest, @Param('workspaceId') workspaceId: string) {
    return this.clockify.getTags(req.user.id, workspaceId);
  }

  @Post('workspaces/:workspaceId/tags')
  @ApiOperation({ summary: 'Create a new tag in a workspace' })
  @ApiParam({ name: 'workspaceId' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['name'],
      properties: { name: { type: 'string' } },
    },
  })
  createTag(
    @Req() req: AuthRequest,
    @Param('workspaceId') workspaceId: string,
    @Body('name') name: string,
  ) {
    return this.clockify.createTag(req.user.id, workspaceId, name);
  }
}
