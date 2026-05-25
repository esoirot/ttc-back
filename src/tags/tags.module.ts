import { Module } from '@nestjs/common';
import { TagsService } from './tags.service';
import { TagsResolver } from './tags.resolver';
import { TagRepository } from './repositories/tag.repository';
import { PrismaTagRepository } from './repositories/prisma-tag.repository';
import { PrismaService } from '../prisma.service';

@Module({
  providers: [
    TagsResolver,
    TagsService,
    PrismaService,
    PrismaTagRepository,
    { provide: TagRepository, useClass: PrismaTagRepository },
  ],
  exports: [TagsService],
})
export class TagsModule {}
