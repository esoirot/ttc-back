import { Injectable } from '@nestjs/common';
import { CreateUserInput } from './dto/create-user.input';
import { UpdateUserInput } from './dto/update-user.input';
import {
  UserRepository,
  type ClockifyUpdate,
} from './repositories/users.repository';
import { UserModel } from './types/user.type';
import { DeleteUserResponse } from './types/delete-user.response';

@Injectable()
export class UsersService {
  constructor(private readonly repo: UserRepository) {}

  findOne(id: number): Promise<UserModel> {
    return this.repo.findById(id);
  }

  findAll(): Promise<UserModel[]> {
    return this.repo.findAll();
  }

  create(input: CreateUserInput): Promise<UserModel> {
    return this.repo.create(input);
  }

  update(id: number, input: UpdateUserInput): Promise<UserModel> {
    return this.repo.update(id, input);
  }

  updateClockify(id: number, data: ClockifyUpdate): Promise<UserModel> {
    return this.repo.updateClockify(id, data);
  }

  async delete(id: number): Promise<DeleteUserResponse> {
    const user = await this.repo.delete(id);
    return { id: user.id };
  }
}
