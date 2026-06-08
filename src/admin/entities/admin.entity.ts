import { ObjectType, Field, Int, Float } from '@nestjs/graphql';
import { CompanyContact } from '../../clients/entities/company-contact.entity';
import { InvoiceItem } from '../../invoices/entities/invoice-item.entity';
import { ProjectStatus } from '../../projects/entities/project.entity';
import { InvoiceStatus } from '../../invoices/entities/invoice.entity';
import { RateType } from '../../generated/prisma/client';

@ObjectType()
class AdminOwner {
  @Field(() => Int)
  id!: number;

  @Field()
  email!: string;

  @Field(() => String, { nullable: true })
  name?: string | null;
}

@ObjectType()
export class AdminStats {
  @Field(() => Int)
  totalUsers!: number;

  @Field(() => Int)
  totalClients!: number;

  @Field(() => Int)
  totalProjects!: number;

  @Field(() => Int)
  totalInvoices!: number;

  @Field(() => Float)
  totalRevenue!: number;

  @Field(() => Int)
  totalTimeSeconds!: number;
}

@ObjectType()
export class AdminClient {
  @Field(() => Int)
  id!: number;

  @Field(() => Int)
  userId!: number;

  @Field()
  name!: string;

  @Field(() => String, { nullable: true })
  legalName?: string | null;

  @Field(() => String, { nullable: true })
  email?: string | null;

  @Field(() => String, { nullable: true })
  phone?: string | null;

  @Field(() => String, { nullable: true })
  company?: string | null;

  @Field(() => String, { nullable: true })
  address?: string | null;

  @Field(() => String, { nullable: true })
  city?: string | null;

  @Field(() => String, { nullable: true })
  country?: string | null;

  @Field(() => String, { nullable: true })
  postalCode?: string | null;

  @Field(() => String, { nullable: true })
  vatNumber?: string | null;

  @Field(() => String, { nullable: true })
  hubspotId?: string | null;

  @Field(() => [CompanyContact])
  contacts!: CompanyContact[];

  @Field(() => AdminOwner)
  owner!: AdminOwner;

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;
}

@ObjectType()
export class AdminClientConnection {
  @Field(() => [AdminClient])
  items!: AdminClient[];

  @Field(() => Int, { nullable: true })
  nextCursor?: number | null;

  @Field(() => Int)
  total!: number;
}

@ObjectType()
export class AdminProject {
  @Field(() => Int)
  id!: number;

  @Field(() => Int, { nullable: true })
  userId?: number | null;

  @Field(() => Int, { nullable: true })
  clientId?: number | null;

  @Field()
  title!: string;

  @Field(() => String, { nullable: true })
  description?: string | null;

  @Field(() => ProjectStatus)
  status!: ProjectStatus;

  @Field(() => String, { nullable: true })
  sourceLanguage?: string | null;

  @Field(() => String, { nullable: true })
  targetLanguage?: string | null;

  @Field(() => Int, { nullable: true })
  wordCount?: number | null;

  @Field(() => Float, { nullable: true })
  unitPrice?: number | null;

  @Field()
  currency!: string;

  @Field(() => Date, { nullable: true })
  deadline?: Date | null;

  @Field(() => Date, { nullable: true })
  startDate?: Date | null;

  @Field(() => AdminOwner, { nullable: true })
  owner?: AdminOwner | null;

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;
}

@ObjectType()
export class AdminProjectConnection {
  @Field(() => [AdminProject])
  items!: AdminProject[];

  @Field(() => Int, { nullable: true })
  nextCursor?: number | null;

  @Field(() => Int)
  total!: number;
}

@ObjectType()
export class AdminInvoice {
  @Field(() => Int)
  id!: number;

  @Field(() => Int)
  userId!: number;

  @Field(() => Int, { nullable: true })
  clientId?: number | null;

  @Field()
  number!: string;

  @Field(() => InvoiceStatus)
  status!: InvoiceStatus;

  @Field()
  currency!: string;

  @Field(() => Date, { nullable: true })
  issuedAt?: Date | null;

  @Field(() => Date, { nullable: true })
  dueDate?: Date | null;

  @Field(() => Date, { nullable: true })
  paidAt?: Date | null;

  @Field(() => String, { nullable: true })
  notes?: string | null;

  @Field(() => [InvoiceItem], { nullable: true })
  items?: InvoiceItem[];

  @Field(() => AdminOwner)
  owner!: AdminOwner;

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;
}

@ObjectType()
export class AdminInvoiceConnection {
  @Field(() => [AdminInvoice])
  items!: AdminInvoice[];

  @Field(() => Int, { nullable: true })
  nextCursor?: number | null;

  @Field(() => Int)
  total!: number;
}

@ObjectType()
class AdminTimeEntry {
  @Field(() => Int)
  id!: number;

  @Field(() => Int)
  userId!: number;

  @Field(() => Int, { nullable: true })
  projectId?: number | null;

  @Field(() => String, { nullable: true })
  description?: string | null;

  @Field()
  startTime!: Date;

  @Field(() => Date, { nullable: true })
  endTime?: Date | null;

  @Field(() => Int, { nullable: true })
  durationSeconds?: number | null;

  @Field()
  billable!: boolean;

  @Field(() => AdminOwner)
  owner!: AdminOwner;

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;
}

@ObjectType()
export class AdminTimeEntryConnection {
  @Field(() => [AdminTimeEntry])
  items!: AdminTimeEntry[];

  @Field(() => Int, { nullable: true })
  nextCursor?: number | null;

  @Field(() => Int)
  total!: number;
}

@ObjectType()
export class AdminRate {
  @Field(() => Int)
  id!: number;

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
  description?: string | null;

  @Field(() => AdminOwner)
  owner!: AdminOwner;

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;
}

@ObjectType()
export class AdminRateConnection {
  @Field(() => [AdminRate])
  items!: AdminRate[];

  @Field(() => Int, { nullable: true })
  nextCursor?: number | null;

  @Field(() => Int)
  total!: number;
}

@ObjectType()
export class AdminDeleteResult {
  @Field(() => Int)
  id!: number;
}
