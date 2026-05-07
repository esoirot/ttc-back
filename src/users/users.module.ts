import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersResolver } from './users.resolver';
import { UserRepository } from './repositories/users.repository';
import { PrismaUserRepository } from './repositories/prisma-user.repository';
import { PrismaService } from '../prisma.service';

@Module({
  providers: [
    UsersResolver,
    UsersService,
    PrismaService,
    PrismaUserRepository,
    {
      provide: UserRepository,
      useClass: PrismaUserRepository,
    },
  ],
  exports: [UsersService],
})
export class UsersModule {}
