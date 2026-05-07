import { Injectable, NotFoundException } from '@nestjs/common';
import { UserRepository } from './users.repository';
import { PrismaService } from '../../prisma.service';
import { UserModel } from '../types/user.type';
import { CreateUserInput } from '../dto/create-user.input';
import { UpdateUserInput } from '../dto/update-user.input';

@Injectable()
export class PrismaUserRepository implements UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: number): Promise<UserModel> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { projects: true },
    });

    if (!user) {
      throw new NotFoundException(`User with id ${id} not found`);
    }

    return user;
  }

  async findAll(): Promise<UserModel[]> {
    return this.prisma.user.findMany({ include: { projects: true } });
  }

  async create(data: CreateUserInput): Promise<UserModel> {
    return this.prisma.user.create({
      data,
    });
  }

  async update(id: number, data: UpdateUserInput): Promise<UserModel> {
    try {
      return await this.prisma.user.update({
        where: { id },
        data,
      });
    } catch {
      throw new NotFoundException(`User with id ${id} not found`);
    }
  }

  async delete(id: number): Promise<UserModel> {
    try {
      return await this.prisma.user.delete({
        where: { id },
      });
    } catch {
      throw new NotFoundException(`User with id ${id} not found`);
    }
  }
}
