import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Redirect,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { FastifyRequest } from 'fastify';
import type { RequestUser } from '../auth/types/gql-context.type.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { HubspotService } from './hubspot.service.js';
import type { CreateContactDto } from './dto/create-contact.dto.js';
import type { UpdateContactDto } from './dto/update-contact.dto.js';
import type { CreateDealDto } from './dto/create-deal.dto.js';
import type { UpdateDealDto } from './dto/update-deal.dto.js';
import type { CreateAssociationDto } from './dto/create-association.dto.js';
import type { SearchObjectsDto } from './dto/search-objects.dto.js';
import type { CreateWebhookSubscriptionDto } from './dto/create-webhook-subscription.dto.js';
import type { HubspotWebhookEvent } from './types/hubspot-webhook.type.js';
import type { CreateCompanyDto } from './dto/create-company.dto.js';
import type { UpdateCompanyDto } from './dto/update-company.dto.js';

type AuthRequest = FastifyRequest & { user: RequestUser };
type RawBodyRequest = FastifyRequest & { rawBody?: string };

@Controller('hubspot')
export class HubspotController {
  constructor(private readonly hubspot: HubspotService) {}

  // --- OAuth ---

  @Get('auth')
  @UseGuards(AuthGuard('jwt'))
  @Redirect()
  initiateOAuth(@Req() req: AuthRequest) {
    return { url: this.hubspot.buildAuthUrl(req.user.id), statusCode: 302 };
  }

  @Get('auth/callback')
  @Redirect()
  async oauthCallback(
    @Query('code') code: string,
    @Query('state') state: string,
  ) {
    await this.hubspot.handleCallback(code, state);
    return { url: this.hubspot.callbackRedirectUrl, statusCode: 302 };
  }

  @Get('status')
  @UseGuards(AuthGuard('jwt'))
  getStatus(@Req() req: AuthRequest) {
    return this.hubspot.getStatus(req.user.id);
  }

  @Delete('disconnect')
  @UseGuards(AuthGuard('jwt'))
  @HttpCode(204)
  disconnect(@Req() req: AuthRequest) {
    return this.hubspot.disconnect(req.user.id);
  }

  // --- Contacts ---

  @Get('contacts')
  @UseGuards(AuthGuard('jwt'))
  listContacts(
    @Req() req: AuthRequest,
    @Query('after') after?: string,
    @Query('limit') limit?: string,
  ) {
    return this.hubspot.listContacts(
      req.user.id,
      after,
      limit ? parseInt(limit, 10) : undefined,
    );
  }

  @Post('contacts/search')
  @UseGuards(AuthGuard('jwt'))
  searchContacts(@Req() req: AuthRequest, @Body() dto: SearchObjectsDto) {
    return this.hubspot.searchContacts(req.user.id, dto);
  }

  @Get('contacts/:id')
  @UseGuards(AuthGuard('jwt'))
  getContact(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.hubspot.getContact(req.user.id, id);
  }

  @Post('contacts')
  @UseGuards(AuthGuard('jwt'))
  createContact(@Req() req: AuthRequest, @Body() dto: CreateContactDto) {
    return this.hubspot.createContact(req.user.id, dto);
  }

  @Patch('contacts/:id')
  @UseGuards(AuthGuard('jwt'))
  updateContact(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Body() dto: UpdateContactDto,
  ) {
    return this.hubspot.updateContact(req.user.id, id, dto);
  }

  @Post('contacts/:id/import-client')
  @UseGuards(AuthGuard('jwt'))
  importContact(@Req() req: AuthRequest, @Param('id') contactId: string) {
    return this.hubspot.importContact(req.user.id, contactId);
  }

  // --- Companies ---

  @Get('companies')
  @UseGuards(AuthGuard('jwt'))
  listCompanies(
    @Req() req: AuthRequest,
    @Query('after') after?: string,
    @Query('limit') limit?: string,
  ) {
    return this.hubspot.listCompanies(
      req.user.id,
      after,
      limit ? parseInt(limit, 10) : undefined,
    );
  }

  @Post('companies/search')
  @UseGuards(AuthGuard('jwt'))
  searchCompanies(@Req() req: AuthRequest, @Body() dto: SearchObjectsDto) {
    return this.hubspot.searchCompanies(req.user.id, dto);
  }

  @Post('companies')
  @UseGuards(AuthGuard('jwt'))
  createCompany(@Req() req: AuthRequest, @Body() dto: CreateCompanyDto) {
    return this.hubspot.createCompany(req.user.id, dto);
  }

  @Get('companies/:id')
  @UseGuards(AuthGuard('jwt'))
  getCompany(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.hubspot.getCompany(req.user.id, id);
  }

  @Patch('companies/:id')
  @UseGuards(AuthGuard('jwt'))
  updateCompany(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Body() dto: UpdateCompanyDto,
  ) {
    return this.hubspot.updateCompany(req.user.id, id, dto);
  }

  // --- Deals ---

  @Get('deals')
  @UseGuards(AuthGuard('jwt'))
  listDeals(
    @Req() req: AuthRequest,
    @Query('after') after?: string,
    @Query('limit') limit?: string,
  ) {
    return this.hubspot.listDeals(
      req.user.id,
      after,
      limit ? parseInt(limit, 10) : undefined,
    );
  }

  @Post('deals/search')
  @UseGuards(AuthGuard('jwt'))
  searchDeals(@Req() req: AuthRequest, @Body() dto: SearchObjectsDto) {
    return this.hubspot.searchDeals(req.user.id, dto);
  }

  @Get('deals/:id')
  @UseGuards(AuthGuard('jwt'))
  getDeal(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.hubspot.getDeal(req.user.id, id);
  }

  @Post('deals')
  @UseGuards(AuthGuard('jwt'))
  createDeal(@Req() req: AuthRequest, @Body() dto: CreateDealDto) {
    return this.hubspot.createDeal(req.user.id, dto);
  }

  @Patch('deals/:id')
  @UseGuards(AuthGuard('jwt'))
  updateDeal(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Body() dto: UpdateDealDto,
  ) {
    return this.hubspot.updateDeal(req.user.id, id, dto);
  }

  // --- Associations (#6) ---

  @Post('associations')
  @UseGuards(AuthGuard('jwt'))
  createAssociation(
    @Req() req: AuthRequest,
    @Body() dto: CreateAssociationDto,
  ) {
    return this.hubspot.createAssociation(req.user.id, dto);
  }

  // --- Admin: connection management ---

  @Get('admin/connections')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('ADMIN')
  listConnections() {
    return this.hubspot.listConnections();
  }

  @Delete('admin/connections/:userId')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('ADMIN')
  @HttpCode(204)
  forceDisconnect(@Param('userId', ParseIntPipe) userId: number) {
    return this.hubspot.disconnect(userId);
  }

  // --- Webhook subscriptions (#9) ---

  @Post('webhooks/subscribe')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('ADMIN')
  subscribeWebhook(@Body() dto: CreateWebhookSubscriptionDto) {
    return this.hubspot.subscribeWebhook(dto);
  }

  // --- Webhooks (no JWT — HMAC-verified) ---

  @Post('webhooks')
  @HttpCode(200)
  handleWebhook(
    @Req() req: RawBodyRequest,
    @Body() body: HubspotWebhookEvent[],
    @Headers('x-hubspot-signature') signature: string,
    @Headers('x-hubspot-request-timestamp') ts: string,
  ) {
    const timestampMs = ts ? parseInt(ts, 10) : undefined;
    this.hubspot.verifyWebhookSignature(
      req.rawBody ?? JSON.stringify(body),
      signature,
      timestampMs,
    );
    this.hubspot.handleWebhookEvents(body);
  }
}
