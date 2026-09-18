import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createGzip } from 'node:zlib';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import type { ScannedFile } from './backup-folder-scan';
import { openScannedFileStream } from './backup-folder-scan';

/**
 * Streaming archive writer — TAR + gzip (Node built-ins, bounded buffers).
 * Download filename uses .tar.gz (plan allows equivalent to ZIP).
 */
export async function writeStreamingTarGz(input: {
  files: ScannedFile[];
  outputPath: string;
}): Promise<{ checksumSha256: string; sizeBytes: number }> {
  const hash = createHash('sha256');
  const gzip = createGzip({ level: 6 });
  const out = createWriteStream(input.outputPath);

  gzip.on('data', (chunk: Buffer) => hash.update(chunk));

  const tarStream = Readable.from(tarGenerator(input.files));
  await pipeline(tarStream, gzip, out);

  const st = await stat(input.outputPath);

  return { checksumSha256: hash.digest('hex'), sizeBytes: st.size };
}

async function* tarGenerator(
  files: ScannedFile[],
): AsyncGenerator<Buffer, void, unknown> {
  for (const file of files) {
    const name = file.archivePath.replace(/\\/g, '/');
    const header = buildTarHeader(name, file.sizeBytes);
    yield header;
    const stream = openScannedFileStream(file);
    for await (const chunk of stream) {
      yield Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    }
    const pad = (512 - (file.sizeBytes % 512)) % 512;
    if (pad > 0) yield Buffer.alloc(pad, 0);
  }
  yield Buffer.alloc(1024, 0);
}

function buildTarHeader(name: string, size: number): Buffer {
  const buf = Buffer.alloc(512, 0);
  const nameBytes = Buffer.from(name.slice(0, 100), 'utf8');
  nameBytes.copy(buf, 0);
  buf.write('0000644\0', 100, 8, 'utf8');
  buf.write('0000000\0', 108, 8, 'utf8');
  buf.write('0000000\0', 116, 8, 'utf8');
  const sizeOct = size.toString(8).padStart(11, '0') + '\0';
  buf.write(sizeOct, 124, 12, 'utf8');
  const mtime = Math.floor(Date.now() / 1000)
    .toString(8)
    .padStart(11, '0');
  buf.write(mtime + '\0', 136, 12, 'utf8');
  buf.write('        ', 148, 8, 'utf8');
  buf.write('0', 156, 1, 'utf8');
  let sum = 0;
  for (let i = 0; i < 512; i++) sum += buf[i]!;
  const checksum = sum.toString(8).padStart(6, '0') + '\0 ';
  buf.write(checksum, 148, 8, 'utf8');
  return buf;
}

/** Re-hash file for verification (streaming). */
export async function sha256File(path: string): Promise<string> {
  const hash = createHash('sha256');
  const stream = createReadStream(path);
  for await (const chunk of stream) {
    hash.update(chunk as Buffer);
  }
  return hash.digest('hex');
}
