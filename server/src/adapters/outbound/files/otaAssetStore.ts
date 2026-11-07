import { randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import zlib from 'node:zlib';

import { isAssetHash } from '../../../modules/ota/domain.ts';
import type {
  AssetEncoding,
  OtaAsset,
  OtaAssetStore,
} from '../../../modules/ota/ports.ts';
import { systemClock, type Clock } from '../../../shared/clock.ts';

const gzip = promisify(zlib.gzip);
const brotli = promisify(zlib.brotliCompress);

const ENCODINGS = ['br', 'gzip'] as const satisfies readonly AssetEncoding[];
const SUFFIX: Record<AssetEncoding, string> = { br: '.br', gzip: '.gz' };
const META = '.json';
/** O nome de cada arquivo da pasta: o SHA-256 em hex e o que ele é. */
const STORED_NAME = /^([0-9a-f]{64})(\.json|\.br|\.gz)?$/;

/** Abaixo disto, comprimir não paga o cabeçalho. */
const MIN_COMPRESSED_BYTES = 1024;
/** Só vale guardar a versão comprimida que economiza um décimo (não uma PNG). */
const WORTH_KEEPING = 0.9;
/** Os temporários de uma gravação interrompida saem depois de um dia. */
const TEMPORARY_TTL_MS = 24 * 60 * 60 * 1000;

/** O que fica no `.json` de cada arquivo. */
type Meta = {
  hash: string;
  contentType: string;
  size: number;
  encodings: Partial<Record<AssetEncoding, number>>;
};

const isMissing = (err: unknown) =>
  (err as NodeJS.ErrnoException | null)?.code === 'ENOENT';

const toAsset = (meta: Meta): OtaAsset => ({
  hash: meta.hash,
  contentType: meta.contentType,
  size: meta.size,
  encodings: { ...meta.encodings },
});

/**
 * Os arquivos das atualizações pelo ar numa pasta (na VM, ao lado da dos
 * anexos, em `~/ao-uerj-server/shared`, que fica de uma implantação para a
 * outra). Cada arquivo fica pelo SHA-256 em hex (o nome não depende de
 * maiúsculas, como no base64url), com as versões em Brotli e gzip feitas uma
 * vez, no envio, e um `.json` com o tipo e os tamanhos. O `.json` é gravado
 * por último e sai primeiro: sem ele, o arquivo não existe. A data dele é o
 * prazo do arquivo, que o reenvio e o manifesto que o cita renovam.
 */
export function createFileOtaAssetStore(
  directory: string,
  { now = systemClock }: { now?: Clock } = {},
): OtaAssetStore {
  const assetsDir = path.join(directory, 'assets');
  const temporaryDir = path.join(directory, 'tmp');

  // A limpeza não se cruza com o "ainda uso este" de um manifesto nem com o
  // reenvio de um arquivo que já está lá: um não apaga o que o outro acabou
  // de renovar. Um arquivo novo não precisa: o prazo dele começa agora.
  let queue: Promise<unknown> = Promise.resolve();
  function exclusive<T>(task: () => Promise<T>): Promise<T> {
    const run = queue.then(task);
    queue = run.catch(() => undefined);
    return run;
  }

  /** O hash vem da URL: só o formato de um hash, nada de caminho. */
  function fileOf(hash: string, suffix = '') {
    if (!isAssetHash(hash)) throw new Error('not an asset hash');
    const name = Buffer.from(hash, 'base64url').toString('hex');
    return path.join(assetsDir, `${name}${suffix}`);
  }

  async function readMeta(hash: string): Promise<Meta | null> {
    try {
      return JSON.parse(await fs.readFile(fileOf(hash, META), 'utf8')) as Meta;
    } catch (err) {
      if (isMissing(err)) return null;
      throw err;
    }
  }

  /** O que já está guardado e inteiro (o tamanho confere); senão, `null`. */
  async function intact(hash: string): Promise<Meta | null> {
    const meta = await readMeta(hash);
    if (!meta) return null;
    const stat = await fs.stat(fileOf(hash)).catch(() => null);
    return stat?.size === meta.size ? meta : null;
  }

  async function touch(hash: string) {
    const at = new Date(now());
    await fs.utimes(fileOf(hash, META), at, at);
  }

  /**
   * Grava num temporário, no disco de fato (fsync), e só então dá o nome:
   * ninguém lê um arquivo pela metade, nem depois de uma queda de energia.
   */
  async function writeAtomically(target: string, data: Uint8Array | string) {
    await fs.mkdir(temporaryDir, { recursive: true });
    const temporary = path.join(temporaryDir, `${randomUUID()}.tmp`);
    try {
      const handle = await fs.open(temporary, 'wx');
      try {
        await handle.writeFile(data);
        await handle.sync();
      } finally {
        await handle.close();
      }
      await fs.rename(temporary, target);
    } catch (err) {
      await fs.rm(temporary, { force: true });
      throw err;
    }
  }

  /** As versões comprimidas, uma de cada vez (a VM tem 1 GB). */
  async function compress(content: Buffer) {
    const variants: Partial<Record<AssetEncoding, Buffer>> = {};
    if (content.length < MIN_COMPRESSED_BYTES) return variants;
    const br = await brotli(content, {
      params: {
        // a 11 levaria segundos e dezenas de MB num bundle; a 9 fica perto
        [zlib.constants.BROTLI_PARAM_QUALITY]: 9,
        [zlib.constants.BROTLI_PARAM_SIZE_HINT]: content.length,
      },
    });
    if (br.length <= content.length * WORTH_KEEPING) variants.br = br;
    const gz = await gzip(content, { level: 9 });
    if (gz.length <= content.length * WORTH_KEEPING) variants.gzip = gz;
    return variants;
  }

  async function removeStaleTemporaries() {
    const names = await fs.readdir(temporaryDir).catch(() => [] as string[]);
    const cutoff = now() - TEMPORARY_TTL_MS;
    for (const name of names) {
      const file = path.join(temporaryDir, name);
      const stat = await fs.stat(file).catch(() => null);
      if (stat && stat.mtimeMs < cutoff) await fs.rm(file, { force: true });
    }
  }

  return {
    async get(hash) {
      const meta = await readMeta(hash);
      if (!meta) return null;
      return {
        ...toAsset(meta),
        open: encoding =>
          createReadStream(fileOf(hash, encoding ? SUFFIX[encoding] : '')),
      };
    },

    async put(hash, content, contentType) {
      const stored = await exclusive(async () => {
        const meta = await intact(hash);
        if (meta) await touch(hash);
        return meta;
      });
      if (stored) return { created: false, asset: toAsset(stored) };

      // um que ficou pela metade (o tamanho não confere) é gravado de novo,
      // com o tipo do primeiro envio
      const previous = await readMeta(hash);
      await fs.mkdir(assetsDir, { recursive: true });
      await writeAtomically(fileOf(hash), content);
      const variants = await compress(content);
      const encodings: Meta['encodings'] = {};
      for (const encoding of ENCODINGS) {
        const data = variants[encoding];
        const file = fileOf(hash, SUFFIX[encoding]);
        if (data) {
          await writeAtomically(file, data);
          encodings[encoding] = data.length;
        } else await fs.rm(file, { force: true });
      }
      const meta: Meta = {
        hash,
        contentType: previous?.contentType ?? contentType,
        size: content.length,
        encodings,
      };
      await writeAtomically(fileOf(hash, META), JSON.stringify(meta));
      await touch(hash);
      return { created: previous === null, asset: toAsset(meta) };
    },

    retain: hashes =>
      exclusive(async () => {
        const missing: string[] = [];
        for (const hash of new Set(hashes)) {
          try {
            await touch(hash);
          } catch (err) {
            if (!isMissing(err)) throw err;
            missing.push(hash);
          }
        }
        return missing;
      }),

    prune: (keep, before) =>
      exclusive(async () => {
        const names = await fs.readdir(assetsDir).catch((err: unknown) => {
          if (isMissing(err)) return [] as string[];
          throw err;
        });
        const groups = new Map<string, string[]>();
        for (const name of names) {
          const hex = STORED_NAME.exec(name)?.[1];
          if (hex) groups.set(hex, [...(groups.get(hex) ?? []), name]);
        }
        let removed = 0;
        for (const [hex, files] of groups) {
          if (keep.has(Buffer.from(hex, 'hex').toString('base64url'))) continue;
          // o prazo é o do .json; sem ele (uma gravação interrompida), o do
          // arquivo que sobrou
          const reference = files.includes(`${hex}${META}`)
            ? `${hex}${META}`
            : files[0];
          const stat = await fs
            .stat(path.join(assetsDir, reference))
            .catch(() => null);
          if (!stat || stat.mtimeMs >= before.getTime()) continue;
          // o .json primeiro: o arquivo deixa de existir antes de o conteúdo sair
          const ordered = [...files].sort(
            (a, b) => Number(b.endsWith(META)) - Number(a.endsWith(META)),
          );
          for (const name of ordered)
            await fs.rm(path.join(assetsDir, name), { force: true });
          removed += 1;
        }
        await removeStaleTemporaries();
        return removed;
      }),
  };
}
