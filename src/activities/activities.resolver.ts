import { Resolver, Query, Mutation, Args, Int } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { ActivitiesService } from './activities.service';
import {
  Activity,
  Charge,
  TranslatorActivity,
  CorrectorActivity,
  CustomActivity,
} from './entities/activity.entity';
import { CreateActivityInput } from './dto/create-activity.input';
import { UpdateActivityInput } from './dto/update-activity.input';
import { CreateChargeInput } from './dto/create-charge.input';
import { UpdateChargeInput } from './dto/update-charge.input';
import { GqlAuthGuard } from '../auth/guards/gql-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

type AnyActivity = TranslatorActivity | CorrectorActivity | CustomActivity;

@Resolver()
@UseGuards(GqlAuthGuard)
export class ActivitiesResolver {
  constructor(private readonly activitiesService: ActivitiesService) {}

  @Query(() => [Activity])
  myActivities(@CurrentUser() user: { id: number }): Promise<AnyActivity[]> {
    return this.activitiesService.findAll(user.id) as Promise<AnyActivity[]>;
  }

  @Query(() => Activity)
  activity(
    @CurrentUser() user: { id: number },
    @Args('id', { type: () => Int }) id: number,
  ): Promise<AnyActivity> {
    return this.activitiesService.findById(id, user.id) as Promise<AnyActivity>;
  }

  @Mutation(() => Activity)
  createActivity(
    @CurrentUser() user: { id: number },
    @Args('input') input: CreateActivityInput,
  ): Promise<AnyActivity> {
    return this.activitiesService.create(
      user.id,
      input,
    ) as Promise<AnyActivity>;
  }

  @Mutation(() => Activity)
  updateActivity(
    @CurrentUser() user: { id: number },
    @Args('input') input: UpdateActivityInput,
  ): Promise<AnyActivity> {
    return this.activitiesService.update(
      input.id,
      user.id,
      input,
    ) as Promise<AnyActivity>;
  }

  @Mutation(() => Boolean)
  async deleteActivity(
    @CurrentUser() user: { id: number },
    @Args('id', { type: () => Int }) id: number,
  ): Promise<boolean> {
    await this.activitiesService.delete(id, user.id);
    return true;
  }

  @Mutation(() => Charge)
  createCharge(
    @CurrentUser() user: { id: number },
    @Args('input') input: CreateChargeInput,
  ): Promise<Charge> {
    return this.activitiesService.createCharge(
      user.id,
      input,
    ) as Promise<Charge>;
  }

  @Mutation(() => Charge)
  updateCharge(
    @CurrentUser() user: { id: number },
    @Args('input') input: UpdateChargeInput,
  ): Promise<Charge> {
    return this.activitiesService.updateCharge(
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
    await this.activitiesService.deleteCharge(id, user.id);
    return true;
  }
}
