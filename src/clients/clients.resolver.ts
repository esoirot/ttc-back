import { Resolver, Query, Mutation, Args, Int } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { ClientsService } from './clients.service';
import { Client } from './entities/client.entity';
import { CompanyContact } from './entities/company-contact.entity';
import { ClientConnection } from './types/client-connection.type';
import { CreateClientInput } from './dto/create-client.input';
import { UpdateClientInput } from './dto/update-client.input';
import { CreateCompanyContactInput } from './dto/create-company-contact.input';
import { UpdateCompanyContactInput } from './dto/update-company-contact.input';
import { GqlAuthGuard } from '../auth/guards/gql-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PaginationInput } from '../common/dto/pagination.input';
import { ClientType, ClientStatus } from './entities/client.entity';

type RequestUser = { id: number; role: string };

@Resolver(() => Client)
export class ClientsResolver {
  constructor(private readonly clientsService: ClientsService) {}

  @UseGuards(GqlAuthGuard)
  @Query(() => ClientConnection, { name: 'clients' })
  findAll(
    @CurrentUser() user: RequestUser,
    @Args('pagination', { nullable: true }) pagination?: PaginationInput,
    @Args('search', { type: () => String, nullable: true }) search?: string,
    @Args('clientType', { type: () => ClientType, nullable: true })
    clientType?: ClientType,
    @Args('excludeStatus', { type: () => ClientStatus, nullable: true })
    excludeStatus?: ClientStatus,
    @Args('status', { type: () => ClientStatus, nullable: true })
    status?: ClientStatus,
  ) {
    return this.clientsService.findAll(
      user.id,
      user.role === 'ADMIN',
      pagination,
      search,
      clientType,
      excludeStatus,
      status,
    );
  }

  @UseGuards(GqlAuthGuard)
  @Query(() => Client, { name: 'client' })
  findOne(
    @Args('id', { type: () => Int }) id: number,
    @CurrentUser() user: RequestUser,
  ) {
    return this.clientsService.findOne(id, user.id);
  }

  @UseGuards(GqlAuthGuard)
  @Mutation(() => Client)
  createClient(
    @Args('input') input: CreateClientInput,
    @CurrentUser() user: RequestUser,
  ) {
    return this.clientsService.create(user.id, input);
  }

  @UseGuards(GqlAuthGuard)
  @Mutation(() => Client)
  updateClient(
    @Args('input') input: UpdateClientInput,
    @CurrentUser() user: RequestUser,
  ) {
    return this.clientsService.update(input.id, user.id, input);
  }

  @UseGuards(GqlAuthGuard)
  @Mutation(() => Boolean)
  deleteClient(
    @Args('id', { type: () => Int }) id: number,
    @CurrentUser() user: RequestUser,
  ) {
    return this.clientsService.delete(id, user.id);
  }

  @UseGuards(GqlAuthGuard)
  @Mutation(() => CompanyContact)
  createCompanyContact(
    @Args('input') input: CreateCompanyContactInput,
    @CurrentUser() user: RequestUser,
  ) {
    return this.clientsService.createContact(user.id, input);
  }

  @UseGuards(GqlAuthGuard)
  @Mutation(() => CompanyContact)
  updateCompanyContact(
    @Args('input') input: UpdateCompanyContactInput,
    @CurrentUser() user: RequestUser,
  ) {
    return this.clientsService.updateContact(input.id, user.id, input);
  }

  @UseGuards(GqlAuthGuard)
  @Mutation(() => Boolean)
  deleteCompanyContact(
    @Args('id', { type: () => Int }) id: number,
    @CurrentUser() user: RequestUser,
  ) {
    return this.clientsService.deleteContact(id, user.id);
  }
}
