import type {
  TonalliAuthChallenge,
  TonalliAuthChallengeRecord,
  TonalliNonceStore,
} from "@xolosarmy/tonalli-auth";

export class InMemoryTonalliNonceStore implements TonalliNonceStore {
  private readonly records = new Map<string, TonalliAuthChallengeRecord>();

  async create(challenge: TonalliAuthChallenge): Promise<void> {
    this.records.set(challenge.nonce, {
      ...challenge,
      usedAt: null,
      revokedAt: null,
    });
  }

  async findByNonce(
    nonce: string,
  ): Promise<TonalliAuthChallengeRecord | null> {
    return this.records.get(nonce) ?? null;
  }

  async markUsed(nonce: string): Promise<void> {
    const record = this.records.get(nonce);

    if (record === undefined) {
      return;
    }

    this.records.set(nonce, {
      ...record,
      usedAt: new Date().toISOString(),
    });
  }

  async revoke(nonce: string): Promise<void> {
    const record = this.records.get(nonce);

    if (record === undefined) {
      return;
    }

    this.records.set(nonce, {
      ...record,
      revokedAt: new Date().toISOString(),
    });
  }
}

// TODO: replace this temporary store with PostgreSQL persistence plus Redis TTL/cache.
export const nonceStore = new InMemoryTonalliNonceStore();
