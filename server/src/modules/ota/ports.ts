import type { Readable } from 'node:stream';

import type {
  NewOtaEntry,
  OtaAnswer,
  OtaEntry,
  OtaPlatform,
} from './domain.ts';

/** O pedido do app: a plataforma, o runtime e o update que ele roda. */
export type OtaRequest = {
  platform: OtaPlatform;
  runtimeVersion: string;
  /** O `expo-current-update-id`, em minúsculas; `null` sem ele. */
  currentUpdateId: string | null;
};

/** As versões comprimidas que um arquivo pode ter, guardadas no envio. */
export type AssetEncoding = 'br' | 'gzip';

/** Um arquivo guardado: o tipo do envio, o tamanho e as versões comprimidas. */
export type OtaAsset = {
  hash: string;
  contentType: string;
  size: number;
  /** O tamanho de cada versão comprimida que vale a pena servir. */
  encodings: Partial<Record<AssetEncoding, number>>;
};

/** Um arquivo para servir: abre o original (`null`) ou uma versão comprimida. */
export type StoredOtaAsset = OtaAsset & {
  open(encoding: AssetEncoding | null): Readable;
};

/** Uma publicação gravada agora (`created`) ou que já estava lá. */
export type OtaPublication = { created: boolean; entry: OtaEntry };

/** Porta de entrada: as atualizações pelo ar. */
export interface OtaUpdates {
  /** Se as publicações estão ligadas (com o certificado do code signing). */
  readonly publishing: boolean;
  /** A resposta ao app: o manifesto, a diretiva ou "nada novo". */
  check(request: OtaRequest): Promise<OtaAnswer>;
  /** Um arquivo pelo hash; `null` se ele não existe. */
  asset(hash: string): Promise<StoredOtaAsset | null>;
  /**
   * Confere o envio de um arquivo antes de ler o corpo: o hash, a assinatura
   * do CI sobre ele e o tipo. Lança o erro da recusa.
   */
  authorizeAsset(upload: {
    hash: string;
    signature: string | undefined;
    contentType: string | undefined;
  }): void;
  /** Guarda um arquivo; reenviar o mesmo não muda nada (`created: false`). */
  uploadAsset(upload: {
    hash: string;
    signature: string | undefined;
    contentType: string | undefined;
    content: Buffer;
  }): Promise<{ created: boolean; asset: OtaAsset }>;
  /** Publica um manifesto assinado, depois dos arquivos dele. */
  publishUpdate(input: {
    platform: OtaPlatform;
    runtimeVersion: string;
    manifest: string;
    signature: string;
  }): Promise<OtaPublication>;
  /** Publica uma diretiva assinada (a volta ao JS da build da loja). */
  publishDirective(input: {
    platform: OtaPlatform;
    runtimeVersion: string;
    directive: string;
    signature: string;
  }): Promise<OtaPublication>;
  /** Apaga os arquivos que nenhum manifesto recente usa; devolve quantos. */
  cleanup(): Promise<number>;
}

/** Porta de saída: onde as publicações ficam. */
export interface OtaEntryRepository {
  /** A publicada por último na plataforma e no runtime. */
  latest(
    platform: OtaPlatform,
    runtimeVersion: string,
  ): Promise<OtaEntry | null>;
  findByUpdateId(
    platform: OtaPlatform,
    runtimeVersion: string,
    updateId: string,
  ): Promise<OtaEntry | null>;
  findByBodyHash(
    platform: OtaPlatform,
    runtimeVersion: string,
    bodyHash: string,
  ): Promise<OtaEntry | null>;
  /** Se o arquivo é o de entrada de um manifesto de outra plataforma. */
  isLaunchAssetOfOtherPlatform(
    hash: string,
    platform: OtaPlatform,
  ): Promise<boolean>;
  /** Grava; `null` se o mesmo texto ou o mesmo `updateId` já está lá. */
  create(entry: NewOtaEntry): Promise<OtaEntry | null>;
  /** Os arquivos dos `perRuntime` manifestos mais recentes de cada plataforma e runtime. */
  keptAssets(perRuntime: number): Promise<Set<string>>;
}

/** Porta de saída: onde os arquivos ficam, pelo hash. */
export interface OtaAssetStore {
  get(hash: string): Promise<StoredOtaAsset | null>;
  /**
   * Guarda o arquivo (já conferido) e as versões comprimidas. Um que já está
   * lá fica como estava (o tipo do primeiro envio), com o prazo renovado.
   */
  put(
    hash: string,
    content: Buffer,
    contentType: string,
  ): Promise<{ created: boolean; asset: OtaAsset }>;
  /** Renova o prazo dos arquivos que um manifesto cita; devolve os que faltam. */
  retain(hashes: readonly string[]): Promise<string[]>;
  /**
   * Apaga os que não estão em `keep` e não foram enviados nem citados desde
   * `before`; devolve quantos.
   */
  prune(keep: ReadonlySet<string>, before: Date): Promise<number>;
}

/** Porta de saída: a conferência das assinaturas do CI. */
export interface OtaSignatureVerifier {
  /**
   * Se `signature` (base64) é a assinatura RSA-SHA256 (PKCS #1 v1.5) dos
   * bytes UTF-8 de `data` pela chave do certificado do app.
   */
  verify(data: string, signature: string): boolean;
}
