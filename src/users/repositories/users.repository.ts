import { CreateUserInput } from '../dto/create-user.input';
import { UpdateUserInput } from '../dto/update-user.input';
import { UserModel } from '../types/user.type';

export abstract class UserRepository {
  abstract findById(id: number): Promise<UserModel>;
  abstract findAll(): Promise<UserModel[]>;
  abstract create(data: CreateUserInput): Promise<UserModel>;
  abstract update(id: number, data: UpdateUserInput): Promise<UserModel>;
  abstract delete(id: number): Promise<UserModel>;
}
