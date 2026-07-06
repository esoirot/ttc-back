import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ClientRepository } from './repositories/client.repository';

const STALE_FOLLOW_UP_DAYS = 21;

@Injectable()
export class ProspectCronService {
  private readonly logger = new Logger(ProspectCronService.name);

  constructor(private readonly clientRepository: ClientRepository) {}

  @Cron('0 5 * * *')
  async promoteStaleFollowUps(): Promise<void> {
    try {
      const cutoff = new Date(Date.now() - STALE_FOLLOW_UP_DAYS * 86_400_000);
      const count = await this.clientRepository.promoteStaleFollowUps(cutoff);
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
