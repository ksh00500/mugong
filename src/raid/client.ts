import { OnlineClient } from '../pvp/client';
import type { RaidRoom, RaidMessage } from './model';
export class RaidClient extends OnlineClient<RaidRoom, number, RaidMessage> {
  constructor() {
    super('/api/pvp/raid-socket');
  }
}
