export class CreateAssociationDto {
  fromObjectType!: string;
  fromObjectId!: string;
  toObjectType!: string;
  toObjectId!: string;
  associationTypeId?: number;
}
