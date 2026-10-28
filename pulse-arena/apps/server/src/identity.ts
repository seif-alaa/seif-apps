import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Guest identity. A token is "<playerId>.<signature>", where the signature is
 * an HMAC of the player id under the server secret. Tokens cannot be forged
 * without the secret, so a client cannot claim another player's id.
 */
export class Identity {
  constructor(private readonly secret: string) {}

  private sign(playerId: string): string {
    return createHmac('sha256', this.secret).update(`guest:${playerId}`).digest('base64url').slice(0, 32);
  }

  issue(): { playerId: string; token: string } {
    const playerId = randomBytes(12).toString('base64url');
    return { playerId, token: `${playerId}.${this.sign(playerId)}` };
  }

  /** Returns the player id for a valid token, otherwise null. */
  verify(token: unknown): string | null {
    if (typeof token !== 'string' || token.length > 128) return null;
    const dot = token.indexOf('.');
    if (dot <= 0) return null;
    const playerId = token.slice(0, dot);
    const sig = token.slice(dot + 1);
    if (!/^[A-Za-z0-9_-]{8,32}$/.test(playerId)) return null;
    const expected = this.sign(playerId);
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    return playerId;
  }
}
