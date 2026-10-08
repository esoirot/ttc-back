import { Module } from '@nestjs/common';
import { TagsService } from './tags.service';
import { TagsResolver } from './tags.resolver';
import { TagRepository } from './repositories/tag.repository';
import { Prisma8TagRepository } from './repositories/prisma8-tag.repository';

@Module({
  providers: [
    TagsResolver,
    TagsService,
    { provide: TagRepository, useClass: Prisma8TagRepository },
  ],
  exports: [TagsService],
})
export class TagsModule {}
