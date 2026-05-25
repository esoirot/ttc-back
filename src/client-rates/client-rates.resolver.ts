import { Resolver, Query, Mutation, Args, Int } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { ClientRatesService } from './client-rates.service';
import { ClientRate } from './entities/client-rate.entity';
import { CreateClientRateInput } from './dto/create-client-rate.input';
import { UpdateClientRateInput } from './dto/update-client-rate.input';
import { GqlAuthGuard } from '../auth/guards/gql-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

type RequestUser = { id: number; role: string };

@Resolver(() => ClientRate)
export class ClientRatesResolver {
  constructor(private readonly clientRatesService: ClientRatesService) {}

  @UseGuards(GqlAuthGuard)
  @Query(() => [ClientRate], { name: 'clientRates' })
  findByClient(
    @CurrentUser() user: RequestUser,
    @Args('clientId', { type: () => Int }) clientId: number,
  ) {
    return this.clientRatesService.findByClient(user.id, clientId);
  }

  @UseGuards(GqlAuthGuard)
  @Mutation(() => ClientRate)
  createClientRate(
    @Args('input') input: CreateClientRateInput,
    @CurrentUser() user: RequestUser,
  ) {
    return this.clientRatesService.create(user.id, input);
  }

  @UseGuards(GqlAuthGuard)
  @Mutation(() => ClientRate)
  updateClientRate(
    @Args('input') input: UpdateClientRateInput,
    @CurrentUser() user: RequestUser,
  ) {
    return this.clientRatesService.update(input.id, user.id, input);
  }

  @UseGuards(GqlAuthGuard)
  @Mutation(() => Boolean)
  deleteClientRate(
    @Args('id', { type: () => Int }) id: number,
    @CurrentUser() user: RequestUser,
  ) {
    return this.clientRatesService.delete(id, user.id);
  }
}
