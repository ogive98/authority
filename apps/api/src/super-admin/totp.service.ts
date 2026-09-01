import { Injectable } from '@nestjs/common';
import { Secret, TOTP } from 'otpauth';

@Injectable()
export class TotpService {
  generateSecret(): string {
    return new Secret({ size: 20 }).base32;
  }

  verify(secretBase32: string, code: string): boolean {
    const totp = new TOTP({
      issuer: 'AUTHORITY',
      label: 'Super Admin',
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: Secret.fromBase32(secretBase32.replace(/\s/g, '')),
    });
    const delta = totp.validate({
      token: code.replace(/\s/g, ''),
      window: 1,
    });
    return delta !== null;
  }

  generate(secretBase32: string, timestamp = Date.now()): string {
    const totp = new TOTP({
      issuer: 'AUTHORITY',
      label: 'Super Admin',
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: Secret.fromBase32(secretBase32.replace(/\s/g, '')),
    });
    return totp.generate({ timestamp });
  }
}
