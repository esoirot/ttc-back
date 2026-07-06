import {
  Controller,
  Get,
  ParseIntPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { AuditService } from './audit.service.js';

@ApiTags('audit')
@ApiCookieAuth('access_token')
@Controller('admin/audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Cursor-paginated audit log (ADMIN only)' })
  @ApiQuery({ name: 'userId', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'cursor', required: false, type: Number })
  findAll(
    @Query('userId', new ParseIntPipe({ optional: true })) userId?: number,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
    @Query('cursor', new ParseIntPipe({ optional: true })) cursor?: number,
  ) {
    return this.auditService.findAll({ userId, limit, cursor });
  }
}
