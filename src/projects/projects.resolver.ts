import { Resolver, Query, Mutation, Args, Int } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { Project, ProjectStatus } from './entities/project.entity';
import { ProjectConnection } from './types/project-connection.type';
import { CreateProjectInput } from './dto/create-project.input';
import { UpdateProjectInput } from './dto/update-project.input';
import { GqlAuthGuard } from '../auth/guards/gql-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PaginationInput } from '../common/dto/pagination.input';

type RequestUser = { id: number; role: string };

@Resolver(() => Project)
export class ProjectsResolver {
  constructor(private readonly projectsService: ProjectsService) {}

  @UseGuards(GqlAuthGuard)
  @Mutation(() => Project)
  createProject(
    @Args('input') input: CreateProjectInput,
    @CurrentUser() user: RequestUser,
  ) {
    return this.projectsService.create(user.id, input);
  }

  @UseGuards(GqlAuthGuard)
  @Query(() => ProjectConnection, { name: 'projects' })
  findAll(
    @CurrentUser() user: RequestUser,
    @Args('status', { type: () => ProjectStatus, nullable: true })
    status?: ProjectStatus,
    @Args('pagination', { nullable: true }) pagination?: PaginationInput,
    @Args('search', { type: () => String, nullable: true }) search?: string,
  ) {
    return this.projectsService.findAll(
      user.id,
      user.role === 'ADMIN',
      status,
      pagination,
      search,
    );
  }

  @UseGuards(GqlAuthGuard)
  @Query(() => Project, { name: 'project', nullable: true })
  findOne(
    @Args('id', { type: () => Int }) id: number,
    @CurrentUser() user: RequestUser,
  ) {
    return this.projectsService.findOne(
      id,
      user.role === 'ADMIN' ? null : user.id,
    );
  }

  @UseGuards(GqlAuthGuard)
  @Mutation(() => Project)
  updateProject(
    @Args('input') input: UpdateProjectInput,
    @CurrentUser() user: RequestUser,
  ) {
    return this.projectsService.update(input.id, user.id, input);
  }

  @UseGuards(GqlAuthGuard)
  @Mutation(() => Boolean)
  deleteProject(
    @Args('id', { type: () => Int }) id: number,
    @CurrentUser() user: RequestUser,
  ) {
    return this.projectsService.delete(id, user.id);
  }
}
