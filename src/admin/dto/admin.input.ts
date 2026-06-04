import { InputType, Field, Int, Float } from '@nestjs/graphql';
import { ProjectStatus } from '../../projects/entities/project.entity';
import { InvoiceStatus } from '../../invoices/entities/invoice.entity';
import { RateType } from '../../generated/prisma/client';

@InputType()
export class AdminCreateClientInput {
  @Field(() => Int)
  userId!: number;

  @Field()
  name!: string;

  @Field(() => String, { nullable: true })
  email?: string;

  @Field(() => String, { nullable: true })
  phone?: string;

  @Field(() => String, { nullable: true })
  legalName?: string;

  @Field(() => String, { nullable: true })
  address?: string;

  @Field(() => String, { nullable: true })
  city?: string;

  @Field(() => String, { nullable: true })
  country?: string;

  @Field(() => String, { nullable: true })
  postalCode?: string;

  @Field(() => String, { nullable: true })
  vatNumber?: string;

  @Field(() => String, { nullable: true })
  hubspotId?: string;

  @Field(() => String, { nullable: true })
  notes?: string;
}

@InputType()
export class AdminUpdateClientInput {
  @Field(() => Int)
  id!: number;

  @Field(() => String, { nullable: true })
  name?: string;

  @Field(() => String, { nullable: true })
  email?: string;

  @Field(() => String, { nullable: true })
  phone?: string;

  @Field(() => String, { nullable: true })
  legalName?: string;

  @Field(() => String, { nullable: true })
  address?: string;

  @Field(() => String, { nullable: true })
  city?: string;

  @Field(() => String, { nullable: true })
  country?: string;

  @Field(() => String, { nullable: true })
  postalCode?: string;

  @Field(() => String, { nullable: true })
  vatNumber?: string;

  @Field(() => String, { nullable: true })
  hubspotId?: string;

  @Field(() => String, { nullable: true })
  notes?: string;
}

@InputType()
export class AdminCreateProjectInput {
  @Field(() => Int)
  userId!: number;

  @Field()
  title!: string;

  @Field(() => ProjectStatus, { nullable: true })
  status?: ProjectStatus;

  @Field(() => Int, { nullable: true })
  clientId?: number;

  @Field(() => String, { nullable: true })
  currency?: string;

  @Field(() => String, { nullable: true })
  description?: string;

  @Field(() => Float, { nullable: true })
  unitPrice?: number;

  @Field(() => Int, { nullable: true })
  wordCount?: number;
}

@InputType()
export class AdminUpdateProjectInput {
  @Field(() => Int)
  id!: number;

  @Field(() => String, { nullable: true })
  title?: string;

  @Field(() => ProjectStatus, { nullable: true })
  status?: ProjectStatus;

  @Field(() => String, { nullable: true })
  description?: string;

  @Field(() => Int, { nullable: true })
  wordCount?: number;

  @Field(() => Float, { nullable: true })
  unitPrice?: number;

  @Field(() => Date, { nullable: true })
  deadline?: Date;
}

@InputType()
export class AdminUpdateInvoiceInput {
  @Field(() => Int)
  id!: number;

  @Field(() => InvoiceStatus, { nullable: true })
  status?: InvoiceStatus;

  @Field(() => String, { nullable: true })
  notes?: string;

  @Field(() => Date, { nullable: true })
  dueDate?: Date;
}

@InputType()
export class AdminCreateRateInput {
  @Field(() => Int)
  userId!: number;

  @Field(() => RateType)
  type!: RateType;

  @Field()
  name!: string;

  @Field(() => Float)
  amount!: number;

  @Field()
  currency!: string;

  @Field(() => String, { nullable: true })
  description?: string;
}

@InputType()
export class AdminUpdateRateInput {
  @Field(() => Int)
  id!: number;

  @Field(() => String, { nullable: true })
  name?: string;

  @Field(() => Float, { nullable: true })
  amount?: number;

  @Field(() => String, { nullable: true })
  currency?: string;

  @Field(() => String, { nullable: true })
  description?: string;
}
