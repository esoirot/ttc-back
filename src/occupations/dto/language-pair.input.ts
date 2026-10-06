import { InputType, Field } from '@nestjs/graphql';

@InputType()
export class LanguagePairInput {
  @Field()
  fromLanguage!: string;

  @Field()
  toLanguage!: string;
}
