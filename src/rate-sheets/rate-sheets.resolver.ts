import { Resolver, Query, Mutation, Args, Int } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { RateSheetsService } from './rate-sheets.service';
import { RateSheet } from './entities/rate-sheet.entity';
import { CreateRateSheetInput } from './dto/create-rate-sheet.input';
import { UpdateRateSheetInput } from './dto/update-rate-sheet.input';
import { GqlAuthGuard } from '../auth/guards/gql-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

type RequestUser = { id: number; role: string };

@Resolver(() => RateSheet)
export class RateSheetsResolver {
  constructor(private readonly rateSheetsService: RateSheetsService) {}

  @UseGuards(GqlAuthGuard)
  @Query(() => [RateSheet], { name: 'rateSheets' })
  findAll(@CurrentUser() user: RequestUser) {
    return this.rateSheetsService.findAll(user.id);
  }

  @UseGuards(GqlAuthGuard)
  @Query(() => RateSheet, { name: 'rateSheet' })
  findOne(
    @Args('id', { type: () => Int }) id: number,
    @CurrentUser() user: RequestUser,
  ) {
    return this.rateSheetsService.findOne(id, user.id);
  }

  @UseGuards(GqlAuthGuard)
  @Mutation(() => RateSheet)
  createRateSheet(
    @Args('input') input: CreateRateSheetInput,
    @CurrentUser() user: RequestUser,
  ) {
    return this.rateSheetsService.create(user.id, input);
  }

  @UseGuards(GqlAuthGuard)
  @Mutation(() => RateSheet)
  updateRateSheet(
    @Args('input') input: UpdateRateSheetInput,
    @CurrentUser() user: RequestUser,
  ) {
    return this.rateSheetsService.update(input.id, user.id, input);
  }

  @UseGuards(GqlAuthGuard)
  @Mutation(() => Boolean)
  deleteRateSheet(
    @Args('id', { type: () => Int }) id: number,
    @CurrentUser() user: RequestUser,
  ) {
    return this.rateSheetsService.delete(id, user.id);
  }
}
