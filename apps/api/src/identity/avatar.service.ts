import { HttpStatus, Injectable } from '@nestjs/common';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { PrismaService } from '../prisma/prisma.service';
import { IDENTITY_ERROR_CODES } from './identity.constants';
import { IdentityException } from './identity.exception';

const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_BYTES = 2 * 1024 * 1024;
const PUBLIC_PATH = '/api/v1/identity/me/avatar';

@Injectable()
export class AvatarService {
  constructor(private readonly prisma: PrismaService) {}

  private rootDir(): string {
    return (
      process.env.AUTHORITY_AVATAR_DIR?.trim() ||
      path.join(process.cwd(), 'data', 'avatars')
    );
  }

  private filePath(userId: string, ext: string): string {
    return path.join(this.rootDir(), `${userId}${ext}`);
  }

  private extForMime(mime: string): string {
    if (mime === 'image/png') return '.png';
    if (mime === 'image/webp') return '.webp';
    return '.jpg';
  }

  async save(input: {
    userId: string;
    buffer: Buffer;
    mime: string;
  }): Promise<{ avatarUrl: string }> {
    if (!ALLOWED.has(input.mime)) {
      throw new IdentityException(
        IDENTITY_ERROR_CODES.VALIDATION,
        'Formats acceptés : JPEG, PNG, WebP.',
        HttpStatus.BAD_REQUEST,
      );
    }
    if (input.buffer.length > MAX_BYTES) {
      throw new IdentityException(
        IDENTITY_ERROR_CODES.VALIDATION,
        'Photo trop volumineuse (max 2 Mo).',
        HttpStatus.BAD_REQUEST,
      );
    }

    const ext = this.extForMime(input.mime);
    const dir = this.rootDir();
    await mkdir(dir, { recursive: true });
    // Remove prior variants
    for (const e of ['.jpg', '.jpeg', '.png', '.webp']) {
      try {
        await unlink(this.filePath(input.userId, e));
      } catch {
        /* missing ok */
      }
    }
    await writeFile(this.filePath(input.userId, ext), input.buffer);

    const bust = Date.now();
    const avatarUrl = `${PUBLIC_PATH}?v=${bust}`;
    await this.prisma.iamUser.update({
      where: { id: input.userId },
      data: { avatarUrl, version: { increment: 1 } },
    });
    return { avatarUrl };
  }

  async clear(userId: string): Promise<void> {
    for (const e of ['.jpg', '.jpeg', '.png', '.webp']) {
      try {
        await unlink(this.filePath(userId, e));
      } catch {
        /* missing ok */
      }
    }
    await this.prisma.iamUser.update({
      where: { id: userId },
      data: { avatarUrl: null, version: { increment: 1 } },
    });
  }

  /** Remove local files without touching DB (when switching to HTTPS URL). */
  async clearFilesOnly(userId: string): Promise<void> {
    for (const e of ['.jpg', '.jpeg', '.png', '.webp']) {
      try {
        await unlink(this.filePath(userId, e));
      } catch {
        /* missing ok */
      }
    }
  }

  async read(
    userId: string,
  ): Promise<{ buffer: Buffer; mime: string } | null> {
    for (const [ext, mime] of [
      ['.jpg', 'image/jpeg'],
      ['.jpeg', 'image/jpeg'],
      ['.png', 'image/png'],
      ['.webp', 'image/webp'],
    ] as const) {
      try {
        const buffer = await readFile(this.filePath(userId, ext));
        return { buffer, mime };
      } catch {
        /* try next */
      }
    }
    return null;
  }
}
