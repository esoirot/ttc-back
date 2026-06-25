import {
  ObjectType,
  Field,
  Int,
  Float,
  registerEnumType,
} from '@nestjs/graphql';
import { CompanyContact } from './company-contact.entity';

export enum ClientType {
  COMPANY = 'COMPANY',
  INDIVIDUAL = 'INDIVIDUAL',
}

registerEnumType(ClientType, { name: 'ClientType' });

export enum ClientIndustry {
  HEALTHCARE = 'HEALTHCARE',
  EDUCATION = 'EDUCATION',
  LEGAL = 'LEGAL',
  FINANCE = 'FINANCE',
  TECHNOLOGY = 'TECHNOLOGY',
  VIDEO_GAMES = 'VIDEO_GAMES',
  MARKETING = 'MARKETING',
  MEDIA_ENTERTAINMENT = 'MEDIA_ENTERTAINMENT',
  E_COMMERCE = 'E_COMMERCE',
  MANUFACTURING = 'MANUFACTURING',
  AUTOMOTIVE = 'AUTOMOTIVE',
  GOVERNMENT = 'GOVERNMENT',
  NGO = 'NGO',
  REAL_ESTATE = 'REAL_ESTATE',
  OTHER = 'OTHER',
}

registerEnumType(ClientIndustry, { name: 'ClientIndustry' });

export enum ClientStatus {
  TO_CONTACT = 'TO_CONTACT',
  CONTACTED = 'CONTACTED',
  FOLLOW_UP_1 = 'FOLLOW_UP_1',
  FOLLOW_UP_2 = 'FOLLOW_UP_2',
  FOLLOW_UP_3 = 'FOLLOW_UP_3',
  RECONTACT_LATER = 'RECONTACT_LATER',
  TALKING = 'TALKING',
  CLIENT = 'CLIENT',
}

registerEnumType(ClientStatus, { name: 'ClientStatus' });

@ObjectType()
class ClientTagItem {
  @Field(() => Int)
  id!: number;

  @Field()
  name!: string;
}

@ObjectType()
export class Client {
  @Field(() => Int)
  id!: number;

  @Field(() => Int)
  userId!: number;

  @Field()
  name!: string;

  @Field(() => String, { nullable: true })
  legalName?: string;

  @Field({ nullable: true })
  email?: string;

  @Field({ nullable: true })
  phone?: string;

  @Field({ nullable: true })
  company?: string;

  @Field({ nullable: true })
  address?: string;

  @Field(() => String, { nullable: true })
  city?: string;

  @Field(() => String, { nullable: true })
  country?: string;

  @Field(() => String, { nullable: true })
  postalCode?: string;

  @Field(() => String, { nullable: true })
  vatNumber?: string;

  @Field({ nullable: true })
  notes?: string;

  @Field({ nullable: true })
  hubspotId?: string;

  @Field(() => ClientType)
  clientType!: ClientType;

  @Field(() => String, { nullable: true })
  firstName?: string;

  @Field(() => String, { nullable: true })
  lastName?: string;

  @Field(() => Int, { nullable: true })
  paymentDelayDays?: number;

  @Field(() => Float, { nullable: true })
  taxRate?: number;

  @Field()
  billingEndOfMonth!: boolean;

  @Field(() => String, { nullable: true })
  website?: string;

  @Field(() => ClientIndustry, { nullable: true })
  industry?: ClientIndustry;

  @Field(() => ClientStatus)
  status!: ClientStatus;

  @Field(() => Date, { nullable: true })
  contactedAt?: Date;

  @Field(() => [ClientTagItem])
  tags!: ClientTagItem[];

  @Field(() => [CompanyContact])
  contacts!: CompanyContact[];

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;
}
