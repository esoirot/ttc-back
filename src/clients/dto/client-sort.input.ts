import { Field, InputType, registerEnumType } from '@nestjs/graphql';

export enum ClientSortField {
  /** The client's name (a company's name). */
  NAME = 'NAME',
  LAST_NAME = 'LAST_NAME',
  FIRST_NAME = 'FIRST_NAME',
}

export enum SortDirection {
  ASC = 'ASC',
  DESC = 'DESC',
}

registerEnumType(ClientSortField, { name: 'ClientSortField' });
registerEnumType(SortDirection, { name: 'SortDirection' });

@InputType()
export class ClientSortInput {
  @Field(() => ClientSortField)
  field!: ClientSortField;

  @Field(() => SortDirection)
  direction!: SortDirection;
}
