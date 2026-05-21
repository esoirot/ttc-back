import { Resolver, Query, Mutation, Args, Int } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { InvoicesService } from './invoices.service';
import { Invoice, InvoiceStatus } from './entities/invoice.entity';
import { InvoiceConnection } from './types/invoice-connection.type';
import { InvoiceItem } from './entities/invoice-item.entity';
import {
  CreateInvoiceInput,
  AddInvoiceItemInput,
  UpdateInvoiceItemInput,
} from './dto/create-invoice.input';
import { UpdateInvoiceInput } from './dto/update-invoice.input';
import { GenerateInvoiceInput } from './dto/generate-invoice.input';
import { GqlAuthGuard } from '../auth/guards/gql-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PaginationInput } from '../common/dto/pagination.input';

type RequestUser = { id: number };

@Resolver(() => Invoice)
export class InvoicesResolver {
  constructor(private readonly invoicesService: InvoicesService) {}

  @UseGuards(GqlAuthGuard)
  @Query(() => InvoiceConnection, { name: 'invoices' })
  findAll(
    @CurrentUser() user: RequestUser,
    @Args('status', { type: () => InvoiceStatus, nullable: true })
    status?: InvoiceStatus,
    @Args('pagination', { nullable: true }) pagination?: PaginationInput,
    @Args('clientId', { type: () => Int, nullable: true }) clientId?: number,
    @Args('search', { type: () => String, nullable: true }) search?: string,
  ) {
    return this.invoicesService.findAll(
      user.id,
      status,
      pagination,
      clientId,
      search,
    );
  }

  @UseGuards(GqlAuthGuard)
  @Query(() => Invoice, { name: 'invoice' })
  findOne(
    @Args('id', { type: () => Int }) id: number,
    @CurrentUser() user: RequestUser,
  ) {
    return this.invoicesService.findOne(id, user.id);
  }

  @UseGuards(GqlAuthGuard)
  @Mutation(() => Invoice)
  createInvoice(
    @Args('input') input: CreateInvoiceInput,
    @CurrentUser() user: RequestUser,
  ) {
    return this.invoicesService.create(user.id, input);
  }

  @UseGuards(GqlAuthGuard)
  @Mutation(() => Invoice)
  generateInvoice(
    @Args('input') input: GenerateInvoiceInput,
    @CurrentUser() user: RequestUser,
  ) {
    return this.invoicesService.generate(user.id, input);
  }

  @UseGuards(GqlAuthGuard)
  @Mutation(() => Invoice)
  updateInvoice(
    @Args('input') input: UpdateInvoiceInput,
    @CurrentUser() user: RequestUser,
  ) {
    return this.invoicesService.update(input.id, user.id, input);
  }

  @UseGuards(GqlAuthGuard)
  @Mutation(() => Boolean)
  deleteInvoice(
    @Args('id', { type: () => Int }) id: number,
    @CurrentUser() user: RequestUser,
  ) {
    return this.invoicesService.delete(id, user.id);
  }

  @UseGuards(GqlAuthGuard)
  @Mutation(() => InvoiceItem)
  addInvoiceItem(@Args('input') input: AddInvoiceItemInput) {
    return this.invoicesService.addItem(input);
  }

  @UseGuards(GqlAuthGuard)
  @Mutation(() => InvoiceItem)
  updateInvoiceItem(@Args('input') input: UpdateInvoiceItemInput) {
    return this.invoicesService.updateItem(input.id, input);
  }

  @UseGuards(GqlAuthGuard)
  @Mutation(() => Boolean)
  removeInvoiceItem(@Args('id', { type: () => Int }) id: number) {
    return this.invoicesService.removeItem(id);
  }
}
