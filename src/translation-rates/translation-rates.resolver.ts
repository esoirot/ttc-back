import { Resolver, Query, Mutation, Args, Int } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { TranslationRatesService } from './translation-rates.service';
import {
  TranslationRate,
  TranslationRateType,
} from './entities/translation-rate.entity';
import { CreateTranslationRateInput } from './dto/create-translation-rate.input';
import { UpdateTranslationRateInput } from './dto/update-translation-rate.input';
import { GqlAuthGuard } from '../auth/guards/gql-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

type RequestUser = { id: number; role: string };

@Resolver(() => TranslationRate)
export class TranslationRatesResolver {
  constructor(private readonly service: TranslationRatesService) {}

  @UseGuards(GqlAuthGuard)
  @Query(() => [TranslationRate], { name: 'translationRates' })
  findAll(
    @CurrentUser() user: RequestUser,
    @Args('type', { type: () => TranslationRateType, nullable: true })
    type?: TranslationRateType,
    @Args('activityId', { type: () => Int, nullable: true })
    activityId?: number,
  ) {
    return this.service.findAll(user.id, type, activityId);
  }

  @UseGuards(GqlAuthGuard)
  @Query(() => TranslationRate, { name: 'translationRate' })
  findOne(
    @Args('id', { type: () => Int }) id: number,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.findOne(id, user.id);
  }

  @UseGuards(GqlAuthGuard)
  @Mutation(() => TranslationRate)
  createTranslationRate(
    @Args('input') input: CreateTranslationRateInput,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.create(user.id, input);
  }

  @UseGuards(GqlAuthGuard)
  @Mutation(() => TranslationRate)
  updateTranslationRate(
    @Args('input') input: UpdateTranslationRateInput,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.update(input.id, user.id, input);
  }

  @UseGuards(GqlAuthGuard)
  @Mutation(() => Boolean)
  deleteTranslationRate(
    @Args('id', { type: () => Int }) id: number,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.delete(id, user.id);
  }
}
