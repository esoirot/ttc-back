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
import {
  ApiCookieAuth,
  ApiExcludeEndpoint,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Throttle } from '@nestjs/throttler';
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

@ApiTags('hubspot')
@Controller('hubspot')
export class HubspotController {
  constructor(private readonly hubspot: HubspotService) {}

  // --- OAuth ---

  @Get('auth')
  @UseGuards(AuthGuard('jwt'))
  @Redirect()
  @ApiCookieAuth('access_token')
  @ApiOperation({ summary: 'Start HubSpot OAuth — redirects to HubSpot' })
  initiateOAuth(@Req() req: AuthRequest) {
    return { url: this.hubspot.buildAuthUrl(req.user.id), statusCode: 302 };
  }

  @Get('auth/callback')
  @Redirect()
  @ApiExcludeEndpoint() // HubSpot-invoked redirect target, not called directly by API clients
  async oauthCallback(
    @Query('code') code: string,
    @Query('state') state: string,
  ) {
    await this.hubspot.handleCallback(code, state);
    return { url: this.hubspot.callbackRedirectUrl, statusCode: 302 };
  }

  @Get('status')
  @UseGuards(AuthGuard('jwt'))
  @ApiCookieAuth('access_token')
  @ApiOperation({ summary: 'Connection status — is HubSpot connected' })
  getStatus(@Req() req: AuthRequest) {
    return this.hubspot.getStatus(req.user.id);
  }

  @Delete('disconnect')
  @UseGuards(AuthGuard('jwt'))
  @HttpCode(204)
  @ApiCookieAuth('access_token')
  @ApiOperation({ summary: 'Disconnect — revoke stored HubSpot token' })
  disconnect(@Req() req: AuthRequest) {
    return this.hubspot.disconnect(req.user.id);
  }

  // --- Contacts ---

  @Get('contacts')
  @UseGuards(AuthGuard('jwt'))
  @ApiCookieAuth('access_token')
  @ApiOperation({ summary: 'List contacts (paginated)' })
  @ApiQuery({ name: 'after', required: false })
  @ApiQuery({ name: 'limit', required: false })
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
  @ApiCookieAuth('access_token')
  @ApiOperation({ summary: 'Search contacts by filter groups' })
  searchContacts(@Req() req: AuthRequest, @Body() dto: SearchObjectsDto) {
    return this.hubspot.searchContacts(req.user.id, dto);
  }

  @Get('contacts/:id')
  @UseGuards(AuthGuard('jwt'))
  @ApiCookieAuth('access_token')
  @ApiOperation({ summary: 'Get a contact by HubSpot ID' })
  @ApiParam({ name: 'id' })
  getContact(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.hubspot.getContact(req.user.id, id);
  }

  @Post('contacts')
  @UseGuards(AuthGuard('jwt'))
  @ApiCookieAuth('access_token')
  @ApiOperation({ summary: 'Create a contact in HubSpot' })
  createContact(@Req() req: AuthRequest, @Body() dto: CreateContactDto) {
    return this.hubspot.createContact(req.user.id, dto);
  }

  @Patch('contacts/:id')
  @UseGuards(AuthGuard('jwt'))
  @ApiCookieAuth('access_token')
  @ApiOperation({ summary: 'Update a contact in HubSpot' })
  @ApiParam({ name: 'id' })
  updateContact(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Body() dto: UpdateContactDto,
  ) {
    return this.hubspot.updateContact(req.user.id, id, dto);
  }

  @Post('contacts/:id/import-client')
  @UseGuards(AuthGuard('jwt'))
  @ApiCookieAuth('access_token')
  @ApiOperation({
    summary: 'Import a HubSpot contact as a TTC client (idempotent)',
  })
  @ApiParam({ name: 'id' })
  importContact(@Req() req: AuthRequest, @Param('id') contactId: string) {
    return this.hubspot.importContact(req.user.id, contactId);
  }

  // --- Companies ---

  @Get('companies')
  @UseGuards(AuthGuard('jwt'))
  @ApiCookieAuth('access_token')
  @ApiOperation({ summary: 'List companies (paginated)' })
  @ApiQuery({ name: 'after', required: false })
  @ApiQuery({ name: 'limit', required: false })
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
  @ApiCookieAuth('access_token')
  @ApiOperation({ summary: 'Search companies by filter groups' })
  searchCompanies(@Req() req: AuthRequest, @Body() dto: SearchObjectsDto) {
    return this.hubspot.searchCompanies(req.user.id, dto);
  }

  @Post('companies')
  @UseGuards(AuthGuard('jwt'))
  @ApiCookieAuth('access_token')
  @ApiOperation({ summary: 'Create a company in HubSpot' })
  createCompany(@Req() req: AuthRequest, @Body() dto: CreateCompanyDto) {
    return this.hubspot.createCompany(req.user.id, dto);
  }

  @Get('companies/:id')
  @UseGuards(AuthGuard('jwt'))
  @ApiCookieAuth('access_token')
  @ApiOperation({ summary: 'Get a company by HubSpot ID' })
  @ApiParam({ name: 'id' })
  getCompany(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.hubspot.getCompany(req.user.id, id);
  }

  @Patch('companies/:id')
  @UseGuards(AuthGuard('jwt'))
  @ApiCookieAuth('access_token')
  @ApiOperation({ summary: 'Update a company in HubSpot' })
  @ApiParam({ name: 'id' })
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
  @ApiCookieAuth('access_token')
  @ApiOperation({ summary: 'List deals (paginated)' })
  @ApiQuery({ name: 'after', required: false })
  @ApiQuery({ name: 'limit', required: false })
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
  @ApiCookieAuth('access_token')
  @ApiOperation({ summary: 'Search deals by filter groups' })
  searchDeals(@Req() req: AuthRequest, @Body() dto: SearchObjectsDto) {
    return this.hubspot.searchDeals(req.user.id, dto);
  }

  @Get('deals/:id')
  @UseGuards(AuthGuard('jwt'))
  @ApiCookieAuth('access_token')
  @ApiOperation({ summary: 'Get a deal by HubSpot ID' })
  @ApiParam({ name: 'id' })
  getDeal(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.hubspot.getDeal(req.user.id, id);
  }

  @Post('deals')
  @UseGuards(AuthGuard('jwt'))
  @ApiCookieAuth('access_token')
  @ApiOperation({ summary: 'Create a deal in HubSpot' })
  createDeal(@Req() req: AuthRequest, @Body() dto: CreateDealDto) {
    return this.hubspot.createDeal(req.user.id, dto);
  }

  @Patch('deals/:id')
  @UseGuards(AuthGuard('jwt'))
  @ApiCookieAuth('access_token')
  @ApiOperation({ summary: 'Update a deal in HubSpot' })
  @ApiParam({ name: 'id' })
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
  @ApiCookieAuth('access_token')
  @ApiOperation({
    summary: 'Associate two HubSpot objects (contact/company/deal)',
  })
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
  @ApiCookieAuth('access_token')
  @ApiOperation({ summary: "List all users' HubSpot connections (ADMIN only)" })
  listConnections() {
    return this.hubspot.listConnections();
  }

  @Delete('admin/connections/:userId')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('ADMIN')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @HttpCode(204)
  @ApiCookieAuth('access_token')
  @ApiOperation({
    summary: "Force-disconnect a user's HubSpot connection (ADMIN only)",
  })
  @ApiParam({ name: 'userId', type: Number })
  forceDisconnect(
    @Param('userId', ParseIntPipe) userId: number,
    @Req() req: AuthRequest,
  ) {
    return this.hubspot.disconnect(userId, req.user.id);
  }

  // --- Webhook subscriptions (#9) ---

  @Post('webhooks/subscribe')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('ADMIN')
  @ApiCookieAuth('access_token')
  @ApiOperation({
    summary: 'Register a HubSpot webhook subscription (ADMIN only)',
  })
  subscribeWebhook(@Body() dto: CreateWebhookSubscriptionDto) {
    return this.hubspot.subscribeWebhook(dto);
  }

  // --- Webhooks (no JWT — HMAC-verified) ---

  @Post('webhooks')
  @HttpCode(200)
  @ApiExcludeEndpoint() // called by HubSpot, verified via HMAC signature headers, not JWT
  handleWebhook(
    @Req() req: RawBodyRequest,
    @Body() body: HubspotWebhookEvent[],
    @Headers('x-hubspot-signature-v3') signature: string,
    @Headers('x-hubspot-request-timestamp') ts: string,
  ) {
    this.hubspot.verifyWebhookSignature(
      req.rawBody ?? JSON.stringify(body),
      signature,
      ts,
    );
    this.hubspot.handleWebhookEvents(body);
  }
}
