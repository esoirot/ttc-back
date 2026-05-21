import { Resolver, Query, Mutation, Args, Int } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { RatesService } from './rates.service';
import { Rate, RateType } from './entities/rate.entity';
import { CreateRateInput } from './dto/create-rate.input';
import { UpdateRateInput } from './dto/update-rate.input';
import { GqlAuthGuard } from '../auth/guards/gql-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

type RequestUser = { id: number; role: string };

@Resolver(() => Rate)
export class RatesResolver {
  constructor(private readonly ratesService: RatesService) {}

  @UseGuards(GqlAuthGuard)
  @Query(() => [Rate], { name: 'rates' })
  findAll(
    @CurrentUser() user: RequestUser,
    @Args('type', { type: () => RateType, nullable: true }) type?: RateType,
  ) {
    return this.ratesService.findAll(user.id, type);
  }

  @UseGuards(GqlAuthGuard)
  @Query(() => Rate, { name: 'rate' })
  findOne(
    @Args('id', { type: () => Int }) id: number,
    @CurrentUser() user: RequestUser,
  ) {
    return this.ratesService.findOne(id, user.id);
  }

  @UseGuards(GqlAuthGuard)
  @Mutation(() => Rate)
  createRate(
    @Args('input') input: CreateRateInput,
    @CurrentUser() user: RequestUser,
  ) {
    return this.ratesService.create(user.id, input);
  }

  @UseGuards(GqlAuthGuard)
  @Mutation(() => Rate)
  updateRate(
    @Args('input') input: UpdateRateInput,
    @CurrentUser() user: RequestUser,
  ) {
    return this.ratesService.update(input.id, user.id, input);
  }

  @UseGuards(GqlAuthGuard)
  @Mutation(() => Boolean)
  deleteRate(
    @Args('id', { type: () => Int }) id: number,
    @CurrentUser() user: RequestUser,
  ) {
    return this.ratesService.delete(id, user.id);
  }
}
