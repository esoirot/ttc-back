import { Resolver, Query, Mutation, Args, Int } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import {
  AdminStats,
  AdminClient,
  AdminClientConnection,
  AdminProject,
  AdminProjectConnection,
  AdminInvoice,
  AdminInvoiceConnection,
  // AdminTimeEntry,
  AdminTimeEntryConnection,
  AdminRate,
  AdminRateConnection,
  AdminDeleteResult,
} from './entities/admin.entity';
import {
  AdminCreateClientInput,
  AdminUpdateClientInput,
  AdminCreateProjectInput,
  AdminUpdateProjectInput,
  AdminUpdateInvoiceInput,
  AdminCreateRateInput,
  AdminUpdateRateInput,
} from './dto/admin.input';
import { GqlAuthGuard } from '../auth/guards/gql-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PaginationInput } from '../common/dto/pagination.input';
import { ProjectStatus } from '../projects/entities/project.entity';
import { InvoiceStatus } from '../invoices/entities/invoice.entity';
import { RateType } from '../generated/prisma/client';

type RequestUser = { id: number; role: string };

@UseGuards(GqlAuthGuard, RolesGuard)
@Roles('ADMIN')
@Resolver()
export class AdminResolver {
  constructor(private readonly adminService: AdminService) {}

  @Query(() => AdminStats, { name: 'adminStats' })
  getStats() {
    return this.adminService.getStats();
  }

  @Query(() => AdminClientConnection, { name: 'adminClients' })
  findClients(
    @Args('pagination', { type: () => PaginationInput, nullable: true })
    pagination?: PaginationInput,
    @Args('search', { type: () => String, nullable: true }) search?: string,
  ) {
    return this.adminService.findClients(pagination, search);
  }

  @Query(() => AdminProjectConnection, { name: 'adminProjects' })
  findProjects(
    @Args('pagination', { type: () => PaginationInput, nullable: true })
    pagination?: PaginationInput,
    @Args('search', { type: () => String, nullable: true }) search?: string,
    @Args('status', { type: () => ProjectStatus, nullable: true })
    status?: ProjectStatus,
  ) {
    return this.adminService.findProjects(pagination, search, status);
  }

  @Query(() => AdminInvoiceConnection, { name: 'adminInvoices' })
  findInvoices(
    @Args('pagination', { type: () => PaginationInput, nullable: true })
    pagination?: PaginationInput,
    @Args('search', { type: () => String, nullable: true }) search?: string,
    @Args('status', { type: () => InvoiceStatus, nullable: true })
    status?: InvoiceStatus,
  ) {
    return this.adminService.findInvoices(pagination, search, status);
  }

  @Query(() => AdminTimeEntryConnection, { name: 'adminTimeEntries' })
  findTimeEntries(
    @Args('pagination', { type: () => PaginationInput, nullable: true })
    pagination?: PaginationInput,
    @Args('userId', { type: () => Int, nullable: true }) userId?: number,
  ) {
    return this.adminService.findTimeEntries(pagination, userId);
  }

  @Query(() => AdminRateConnection, { name: 'adminRates' })
  findRates(
    @Args('type', { type: () => RateType, nullable: true }) type?: RateType,
  ) {
    return this.adminService.findRates(type);
  }

  @Mutation(() => AdminClient)
  adminCreateClient(
    @Args('input') input: AdminCreateClientInput,
    @CurrentUser() user: RequestUser,
  ) {
    return this.adminService.createClient(user.id, input);
  }

  @Mutation(() => AdminClient)
  adminUpdateClient(
    @Args('input') input: AdminUpdateClientInput,
    @CurrentUser() user: RequestUser,
  ) {
    return this.adminService.updateClient(user.id, input.id, input);
  }

  @Mutation(() => AdminDeleteResult)
  adminDeleteClient(
    @Args('id', { type: () => Int }) id: number,
    @CurrentUser() user: RequestUser,
  ) {
    return this.adminService.deleteClient(user.id, id);
  }

  @Mutation(() => AdminProject)
  adminCreateProject(
    @Args('input') input: AdminCreateProjectInput,
    @CurrentUser() user: RequestUser,
  ) {
    return this.adminService.createProject(user.id, input);
  }

  @Mutation(() => AdminProject)
  adminUpdateProject(
    @Args('input') input: AdminUpdateProjectInput,
    @CurrentUser() user: RequestUser,
  ) {
    return this.adminService.updateProject(user.id, input.id, input);
  }

  @Mutation(() => AdminDeleteResult)
  adminDeleteProject(
    @Args('id', { type: () => Int }) id: number,
    @CurrentUser() user: RequestUser,
  ) {
    return this.adminService.deleteProject(user.id, id);
  }

  @Mutation(() => AdminInvoice)
  adminUpdateInvoice(
    @Args('input') input: AdminUpdateInvoiceInput,
    @CurrentUser() user: RequestUser,
  ) {
    return this.adminService.updateInvoice(user.id, input.id, input);
  }

  @Mutation(() => AdminDeleteResult)
  adminDeleteInvoice(
    @Args('id', { type: () => Int }) id: number,
    @CurrentUser() user: RequestUser,
  ) {
    return this.adminService.deleteInvoice(user.id, id);
  }

  @Mutation(() => AdminDeleteResult)
  adminDeleteTimeEntry(
    @Args('id', { type: () => Int }) id: number,
    @CurrentUser() user: RequestUser,
  ) {
    return this.adminService.deleteTimeEntry(user.id, id);
  }

  @Mutation(() => AdminRate)
  adminCreateRate(
    @Args('input') input: AdminCreateRateInput,
    @CurrentUser() user: RequestUser,
  ) {
    return this.adminService.createRate(user.id, input);
  }

  @Mutation(() => AdminRate)
  adminUpdateRate(
    @Args('input') input: AdminUpdateRateInput,
    @CurrentUser() user: RequestUser,
  ) {
    return this.adminService.updateRate(user.id, input.id, input);
  }

  @Mutation(() => AdminDeleteResult)
  adminDeleteRate(
    @Args('id', { type: () => Int }) id: number,
    @CurrentUser() user: RequestUser,
  ) {
    return this.adminService.deleteRate(user.id, id);
  }
}
