import { Resolver, Query, Mutation, Args, Int } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { OccupationsService } from './occupations.service';
import {
  Occupation,
  Charge,
  TranslatorOccupation,
  CorrectorOccupation,
  CustomOccupation,
} from './entities/occupation.entity';
import { CreateOccupationInput } from './dto/create-occupation.input';
import { UpdateOccupationInput } from './dto/update-occupation.input';
import { CreateChargeInput } from './dto/create-charge.input';
import { UpdateChargeInput } from './dto/update-charge.input';
import { GqlAuthGuard } from '../auth/guards/gql-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

type AnyOccupation =
  TranslatorOccupation | CorrectorOccupation | CustomOccupation;

@Resolver()
@UseGuards(GqlAuthGuard)
export class OccupationsResolver {
  constructor(private readonly occupationsService: OccupationsService) {}

  @Query(() => [Occupation])
  myOccupations(@CurrentUser() user: { id: number }): Promise<AnyOccupation[]> {
    return this.occupationsService.findAll(user.id) as Promise<AnyOccupation[]>;
  }

  @Query(() => Occupation)
  occupation(
    @CurrentUser() user: { id: number },
    @Args('id', { type: () => Int }) id: number,
  ): Promise<AnyOccupation> {
    return this.occupationsService.findById(
      id,
      user.id,
    ) as Promise<AnyOccupation>;
  }

  @Mutation(() => Occupation)
  createOccupation(
    @CurrentUser() user: { id: number },
    @Args('input') input: CreateOccupationInput,
  ): Promise<AnyOccupation> {
    return this.occupationsService.create(
      user.id,
      input,
    ) as Promise<AnyOccupation>;
  }

  @Mutation(() => Occupation)
  updateOccupation(
    @CurrentUser() user: { id: number },
    @Args('input') input: UpdateOccupationInput,
  ): Promise<AnyOccupation> {
    return this.occupationsService.update(
      input.id,
      user.id,
      input,
    ) as Promise<AnyOccupation>;
  }

  @Mutation(() => Boolean)
  async deleteOccupation(
    @CurrentUser() user: { id: number },
    @Args('id', { type: () => Int }) id: number,
  ): Promise<boolean> {
    await this.occupationsService.delete(id, user.id);
    return true;
  }

  @Mutation(() => Charge)
  createCharge(
    @CurrentUser() user: { id: number },
    @Args('input') input: CreateChargeInput,
  ): Promise<Charge> {
    return this.occupationsService.createCharge(
      user.id,
      input,
    ) as Promise<Charge>;
  }

  @Mutation(() => Charge)
  updateCharge(
    @CurrentUser() user: { id: number },
    @Args('input') input: UpdateChargeInput,
  ): Promise<Charge> {
    return this.occupationsService.updateCharge(
      input.id,
      user.id,
      input,
    ) as Promise<Charge>;
  }

  @Mutation(() => Boolean)
  async deleteCharge(
    @CurrentUser() user: { id: number },
    @Args('id', { type: () => Int }) id: number,
  ): Promise<boolean> {
    await this.occupationsService.deleteCharge(id, user.id);
    return true;
  }
}
