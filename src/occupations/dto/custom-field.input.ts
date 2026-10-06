import { InputType, Field } from '@nestjs/graphql';

@InputType()
export class CustomFieldInput {
  @Field()
  key!: string;

  @Field()
  value!: string;
}
