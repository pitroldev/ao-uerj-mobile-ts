import type {
  OtaEntry,
  OtaEntryKind,
  OtaPlatform,
} from '../../../modules/ota/domain.ts';
import type { OtaEntryRepository } from '../../../modules/ota/ports.ts';
import { guarded, isDuplicateKey } from './guarded.ts';
import type { Models } from './models.ts';

type StoredEntry = {
  _id: unknown;
  platform: OtaPlatform;
  runtimeVersion: string;
  kind: OtaEntryKind;
  body: string;
  signature: string;
  bodyHash: string;
  updateId?: string | null;
  commitTime: Date;
  launchAsset?: string | null;
  assets?: string[];
  publishedAt: Date;
};

function toEntry(doc: StoredEntry): OtaEntry {
  return {
    id: String(doc._id),
    platform: doc.platform,
    runtimeVersion: doc.runtimeVersion,
    kind: doc.kind,
    body: doc.body,
    signature: doc.signature,
    bodyHash: doc.bodyHash,
    updateId: doc.updateId ?? null,
    commitTime: doc.commitTime,
    launchAsset: doc.launchAsset ?? null,
    assets: [...(doc.assets ?? [])],
    publishedAt: doc.publishedAt,
  };
}

const one = (doc: StoredEntry | null) => (doc ? toEntry(doc) : null);

/** A ordem das publicações: a mais recente primeiro (o `_id` desempata). */
const NEWEST = { publishedAt: -1, _id: -1 } as const;

export function createOtaEntryRepository(
  model: Models['otaEntries'],
): OtaEntryRepository {
  return {
    latest: (platform, runtimeVersion) =>
      guarded(async () =>
        one(
          await model
            .findOne({ platform, runtimeVersion })
            .sort(NEWEST)
            .lean<StoredEntry>(),
        ),
      ),
    findByUpdateId: (platform, runtimeVersion, updateId) =>
      guarded(async () =>
        one(
          await model
            .findOne({ platform, runtimeVersion, updateId })
            .lean<StoredEntry>(),
        ),
      ),
    findByBodyHash: (platform, runtimeVersion, bodyHash) =>
      guarded(async () =>
        one(
          await model
            .findOne({ platform, runtimeVersion, bodyHash })
            .lean<StoredEntry>(),
        ),
      ),
    isLaunchAssetOfOtherPlatform: (hash, platform) =>
      guarded(
        async () =>
          (await model.exists({
            launchAsset: hash,
            platform: { $ne: platform },
          })) !== null,
      ),
    create: entry =>
      guarded(async () => {
        try {
          const created = await model.create(entry);
          return toEntry(created.toObject<StoredEntry>());
        } catch (err) {
          // o mesmo texto ou o mesmo update, gravado por outro envio
          if (isDuplicateKey(err)) return null;
          throw err;
        }
      }),
    keptAssets: perRuntime =>
      guarded(async () => {
        const groups = await model.aggregate<{ kept: string[][] }>([
          { $match: { kind: 'manifest' } },
          {
            $group: {
              _id: { platform: '$platform', runtimeVersion: '$runtimeVersion' },
              kept: {
                $topN: { n: perRuntime, sortBy: NEWEST, output: '$assets' },
              },
            },
          },
        ]);
        return new Set(groups.flatMap(group => group.kept.flat()));
      }),
  };
}
