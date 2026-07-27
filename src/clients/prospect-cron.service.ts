import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ClientRepository } from './repositories/client.repository';
import { ClientStatusHistoryService } from './client-status-history.service';

const STALE_FOLLOW_UP_DAYS = 21;

@Injectable()
export class ProspectCronService {
  private readonly logger = new Logger(ProspectCronService.name);

  constructor(
    private readonly clientRepository: ClientRepository,
    private readonly statusHistory: ClientStatusHistoryService,
  ) {}

  @Cron('0 5 * * *')
  async promoteStaleFollowUps(): Promise<void> {
    try {
      const cutoff = new Date(Date.now() - STALE_FOLLOW_UP_DAYS * 86_400_000);
      const stale =
        await this.clientRepository.findStaleFollowUpClientIds(cutoff);
      if (stale.length === 0) {
        this.logger.log(
          'Moved 0 stale FOLLOW_UP_3 prospect(s) to RECONTACT_LATER',
        );
        return;
      }
      const count = await this.clientRepository.promoteClients(
        stale.map((c) => c.id),
      );
      await this.statusHistory.logMany(
        stale.map((c) => ({
          clientId: c.id,
          userId: c.userId,
          type: 'STATUS_CHANGED',
          payload: { from: 'FOLLOW_UP_3', to: 'RECONTACT_LATER' },
        })),
      );
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
