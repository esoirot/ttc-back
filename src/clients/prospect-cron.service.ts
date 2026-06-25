import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma.service';
import { ClientStatus as PrismaClientStatus } from '../generated/prisma/client';

const STALE_FOLLOW_UP_DAYS = 21;

@Injectable()
export class ProspectCronService {
  private readonly logger = new Logger(ProspectCronService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron('0 5 * * *')
  async promoteStaleFollowUps(): Promise<void> {
    try {
      const cutoff = new Date(Date.now() - STALE_FOLLOW_UP_DAYS * 86_400_000);
      const { count } = await this.prisma.client.updateMany({
        where: {
          status: PrismaClientStatus.FOLLOW_UP_3,
          contactedAt: { lt: cutoff },
        },
        data: { status: PrismaClientStatus.RECONTACT_LATER },
      });
      this.logger.log(
        `Moved ${count} stale FOLLOW_UP_3 prospect(s) to RECONTACT_LATER`,
      );
    } catch (err: unknown) {
      this.logger.error(
        'Failed to promote stale prospects to RECONTACT_LATER',
        String(err),
      );
    }
  }
}
