import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersResolver } from './users.resolver';
import { UserRepository } from './repositories/users.repository';
import { Prisma8UserRepository } from './repositories/prisma8-user.repository';

@Module({
  providers: [
    UsersResolver,
    UsersService,
    {
      provide: UserRepository,
      useClass: Prisma8UserRepository,
    },
  ],
  exports: [UsersService],
})
export class UsersModule {}
