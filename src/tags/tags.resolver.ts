import { Resolver, Query, Mutation, Args, Int } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { TagsService } from './tags.service';
import { Tag } from './entities/tag.entity';
import { CreateTagInput } from './dto/create-tag.input';
import { UpdateTagInput } from './dto/update-tag.input';
import { GqlAuthGuard } from '../auth/guards/gql-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

type RequestUser = { id: number; role: string };

@Resolver(() => Tag)
export class TagsResolver {
  constructor(private readonly tagsService: TagsService) {}

  @UseGuards(GqlAuthGuard)
  @Query(() => [Tag], { name: 'tags' })
  findAll(@CurrentUser() user: RequestUser) {
    return this.tagsService.findAll(user.id);
  }

  @UseGuards(GqlAuthGuard)
  @Mutation(() => Tag)
  createTag(
    @Args('input') input: CreateTagInput,
    @CurrentUser() user: RequestUser,
  ) {
    return this.tagsService.create(user.id, input.name);
  }

  @UseGuards(GqlAuthGuard)
  @Mutation(() => Tag)
  updateTag(
    @Args('input') input: UpdateTagInput,
    @CurrentUser() user: RequestUser,
  ) {
    return this.tagsService.update(input.id, user.id, input.name);
  }

  @UseGuards(GqlAuthGuard)
  @Mutation(() => Boolean)
  deleteTag(
    @Args('id', { type: () => Int }) id: number,
    @CurrentUser() user: RequestUser,
  ) {
    return this.tagsService.delete(id, user.id);
  }
}
