#!/usr/bin/env node
/*
 * Publica um update OTA (o JavaScript e os assets, nunca o código nativo) no
 * servidor de pitrol.dev, pelo protocolo Expo Updates v1 e sem o EAS. O
 * passo a passo e as regras estão em docs/ota.md.
 *
 *   node scripts/ota/publish.cjs --platform <android|ios|both> [opções]
 *
 * --rollback               publica a diretiva rollBackToEmbedded: os aparelhos
 *                          voltam ao JS que veio na build da loja
 * --dry-run                grava manifests, assinaturas e requisições numa
 *                          pasta, sem rede (sem chave, assina com uma
 *                          descartável, que nenhum aparelho aceita)
 * --out-dir <pasta>        a pasta do export e do dry-run, vazia (padrão: uma
 *                          temporária)
 * --export-dir <pasta>     usa um `expo export` já feito em vez de rodar outro
 * --base-url <url>         o servidor (padrão https://pitrol.dev); http só em
 *                          localhost, para o QA
 * --runtime-version [<plataforma>=]<valor>
 *                          o runtime de destino. Num update, tem de ser o do
 *                          código (scripts/ota/runtime-version.cjs); na volta,
 *                          dispensa o cálculo
 * --key-file <arquivo>     a chave privada em PEM (QA local); no CI, ela vem
 *                          do secret OTA_SIGNING_KEY
 * --certificate <arquivo>  o certificado com que conferir a chave antes do
 *                          envio (padrão: config/ota/certificate.pem, o que o
 *                          app embute)
 * --message <texto>        o que muda; vai para o log e o resumo do run, não
 *                          para o manifest
 *
 * Tudo é exportado e assinado antes do primeiro envio. Os assets sobem antes
 * dos manifests: um update publicado nunca aponta para um arquivo que o
 * servidor não tem. A chave não vai para o log, para a pasta do dry-run nem
 * para os processos filhos: o `expo export` não a enxerga, então nenhum
 * plugin do Babel tem como embuti-la no bundle.
 */
const crypto = require('node:crypto');
const { execFileSync, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const PLATFORMS = ['android', 'ios'];
const DEFAULT_BASE_URL = 'https://pitrol.dev';
const ROUTES = {
  asset: '/aouerj/ota/assets/',
  update: '/aouerj/ota/updates',
  directive: '/aouerj/ota/directives',
};
const KEY_ENV = 'OTA_SIGNING_KEY';
// o certificado público que o build do app embute (android/app/build.gradle)
const CERTIFICATE = 'config/ota/certificate.pem';
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);
// vai no cabeçalho expo-runtime-version do app: uma linha de ASCII visível
const RUNTIME_VERSION = /^[!-~]{1,255}$/;
const UPLOAD_LANES = 4;
const UPLOAD_ATTEMPTS = 3;
const REQUEST_TIMEOUT_MS = 120_000;

// Os tipos dos assets que o Metro exporta (imagens, fontes, mídia), os mesmos
// do pacote `mime` que o servidor de exemplo da Expo usa, sem a dependência.
const CONTENT_TYPES = {
  bmp: 'image/bmp',
  gif: 'image/gif',
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  png: 'image/png',
  svg: 'image/svg+xml',
  webp: 'image/webp',
  otf: 'font/otf',
  ttf: 'font/ttf',
  woff: 'font/woff',
  woff2: 'font/woff2',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  mp4: 'video/mp4',
  css: 'text/css',
  html: 'text/html',
  js: 'application/javascript',
  json: 'application/json',
  txt: 'text/plain',
};

const annotate = (kind, message) =>
  process.env.GITHUB_ACTIONS === 'true' ? `::${kind}::${message}` : message;

/** SHA-256 em base64url sem padding: o `hash` do protocolo e o nome do asset no servidor. */
const sha256 = bytes =>
  crypto.createHash('sha256').update(bytes).digest('base64url');

/** MD5 em hexa: a `key` do asset, como no servidor de exemplo (é o nome que o export dá ao arquivo). */
const md5 = bytes => crypto.createHash('md5').update(bytes).digest('hex');

function contentTypeFor(ext) {
  return (
    CONTENT_TYPES[String(ext ?? '').toLowerCase()] ?? 'application/octet-stream'
  );
}

function normalizeBaseUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`--base-url inválida: ${value}`);
  }
  const local = url.protocol === 'http:' && LOCAL_HOSTS.has(url.hostname);
  if (url.protocol !== 'https:' && !local)
    throw new Error(
      '--base-url tem de ser https (http só em localhost, para o QA).',
    );
  if (url.search || url.hash || url.username || url.password)
    throw new Error('--base-url não leva query, fragmento nem credenciais.');
  return url.href.replace(/\/+$/, '');
}

const assetUrl = (baseUrl, hash) => `${baseUrl}${ROUTES.asset}${hash}`;

function validateRuntimeVersion(value, label = 'O runtime version') {
  if (typeof value !== 'string' || !RUNTIME_VERSION.test(value))
    throw new Error(
      `${label} não é válido (uma linha, sem espaços, até 255 caracteres): ${JSON.stringify(String(value).slice(0, 80))}.`,
    );
  return value;
}

/** Um caminho do metadata.json dentro do export (o Windows grava com "\"). */
function exportFile(exportDir, relative) {
  if (typeof relative !== 'string' || !relative)
    throw new Error('O metadata.json tem um caminho vazio.');
  const parts = relative.split(/[\\/]+/).filter(Boolean);
  if (path.isAbsolute(relative) || /^[A-Za-z]:/.test(relative))
    throw new Error(`Caminho absoluto no metadata.json: ${relative}`);
  if (parts.includes('..'))
    throw new Error(`Caminho fora do export no metadata.json: ${relative}`);
  return path.join(exportDir, ...parts);
}

/**
 * O bundle e os assets de uma plataforma no metadata.json do `expo export`:
 * `{ version: 0, bundler, fileMetadata: { [plataforma]: { bundle, assets:
 * [{ path, ext }] } } }`. Um formato que este script não conhece para tudo.
 */
function readExportMetadata(metadata, platform) {
  if (metadata?.version !== 0)
    throw new Error(
      `O metadata.json está na versão ${JSON.stringify(metadata?.version)}, e este script conhece só a 0: confira o formato do \`expo export\`.`,
    );
  const files = metadata.fileMetadata?.[platform];
  if (typeof files?.bundle !== 'string' || !files.bundle)
    throw new Error(
      `O export não tem o bundle de ${platform} (metadata.json).`,
    );
  if (!Array.isArray(files.assets))
    throw new Error(`O metadata.json não lista os assets de ${platform}.`);
  return {
    bundle: files.bundle,
    assets: files.assets.map(asset => {
      if (typeof asset?.path !== 'string' || !asset.path)
        throw new Error(
          `Um asset de ${platform} sem caminho no metadata.json.`,
        );
      const ext =
        typeof asset.ext === 'string' && asset.ext
          ? asset.ext.replace(/^\./, '')
          : undefined;
      // o Android pula, em silêncio, um asset sem fileExtension, e o servidor
      // recusa o manifest: melhor parar aqui, dizendo qual
      if (!ext)
        throw new Error(
          `O asset ${asset.path} de ${platform} não tem extensão no metadata.json.`,
        );
      return { path: asset.path, ext };
    }),
  };
}

/** A entrada de um arquivo no manifest (o Asset do protocolo). */
function describeAsset(bytes, { baseUrl, ext, launch = false }) {
  const hash = sha256(bytes);
  // como no servidor de exemplo: o bundle leva ".bundle", os outros a extensão
  const extension = launch ? 'bundle' : ext;
  return {
    hash,
    key: md5(bytes),
    contentType: launch ? 'application/javascript' : contentTypeFor(ext),
    ...(extension ? { fileExtension: `.${extension}` } : {}),
    url: assetUrl(baseUrl, hash),
  };
}

function buildManifest({ id, createdAt, runtimeVersion, launchAsset, assets }) {
  return {
    id,
    createdAt,
    runtimeVersion,
    launchAsset,
    assets,
    metadata: {},
    extra: {},
  };
}

/**
 * O manifest de uma plataforma e os arquivos que ele cita, a partir do
 * metadata.json do export. `readFile` lê um caminho do metadata.json.
 */
function planUpdate({
  platform,
  runtimeVersion,
  metadata,
  readFile,
  baseUrl,
  id,
  createdAt,
}) {
  const { bundle, assets } = readExportMetadata(metadata, platform);
  const files = [];
  const add = (relative, options) => {
    const bytes = readFile(relative);
    const entry = describeAsset(bytes, { baseUrl, ...options });
    files.push({
      hash: entry.hash,
      contentType: entry.contentType,
      path: relative,
      bytes,
    });
    return entry;
  };
  const launchAsset = add(bundle, { launch: true });
  const manifest = buildManifest({
    id,
    createdAt,
    runtimeVersion,
    launchAsset,
    assets: assets.map(asset => add(asset.path, { ext: asset.ext })),
  });
  return { platform, runtimeVersion, manifest, files };
}

/** A volta ao JS da build da loja; um update com createdAt depois de `commitTime` vale de novo. */
function rollbackDirective(commitTime) {
  return { type: 'rollBackToEmbedded', parameters: { commitTime } };
}

/** RSA-SHA256 (PKCS#1 v1.5) sobre os bytes UTF-8 exatos de `data`, em base64. */
function signRsaSha256(data, privateKey) {
  return crypto
    .sign('sha256', Buffer.from(data, 'utf8'), {
      key: privateKey,
      padding: crypto.constants.RSA_PKCS1_PADDING,
    })
    .toString('base64');
}

const jsonRequest = (url, payload) => ({
  method: 'POST',
  url,
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(payload),
});

/** PUT do arquivo cru; a assinatura é sobre o hash, em ASCII. */
function assetRequest(baseUrl, file, privateKey) {
  return {
    method: 'PUT',
    url: assetUrl(baseUrl, file.hash),
    headers: {
      'content-type': file.contentType,
      'expo-ota-signature': signRsaSha256(file.hash, privateKey),
    },
    body: file.bytes,
  };
}

/** O manifest vai como texto: o servidor o devolve ao app byte a byte, e a assinatura é sobre esse texto. */
function updateRequest(baseUrl, { platform, runtimeVersion, manifest }, key) {
  const text = JSON.stringify(manifest);
  return jsonRequest(`${baseUrl}${ROUTES.update}`, {
    platform,
    runtimeVersion,
    manifest: text,
    signature: signRsaSha256(text, key),
  });
}

function directiveRequest(
  baseUrl,
  { platform, runtimeVersion, directive },
  key,
) {
  const text = JSON.stringify(directive);
  return jsonRequest(`${baseUrl}${ROUTES.directive}`, {
    platform,
    runtimeVersion,
    directive: text,
    signature: signRsaSha256(text, key),
  });
}

function parsePrivateKey(text) {
  // um secret colado numa linha só, com "\n" literais
  const pem = text.includes('\n') ? text : text.replaceAll('\\n', '\n');
  let key;
  try {
    key = crypto.createPrivateKey({ key: pem, format: 'pem' });
  } catch {
    // a mensagem do OpenSSL pode citar o conteúdo: não vai para o log
    throw new Error(
      'A chave de assinatura não é uma chave privada PEM sem senha.',
    );
  }
  if (key.asymmetricKeyType !== 'rsa')
    throw new Error('A chave de assinatura tem de ser RSA (rsa-v1_5-sha256).');
  if ((key.asymmetricKeyDetails?.modulusLength ?? 0) < 2048)
    throw new Error('A chave RSA tem de ter 2048 bits ou mais.');
  return key;
}

function loadSigningKey({ keyFile, dryRun }, env) {
  if (keyFile)
    return { key: parsePrivateKey(fs.readFileSync(keyFile, 'utf8')) };
  if (env[KEY_ENV]) return { key: parsePrivateKey(env[KEY_ENV]) };
  if (dryRun) {
    const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
    });
    return {
      key: privateKey,
      ephemeralPublicKey: publicKey.export({ type: 'spki', format: 'pem' }),
    };
  }
  throw new Error(
    `Falta a chave de assinatura: o secret ${KEY_ENV} (environment play) ou --key-file.`,
  );
}

/** O certificado que o app embute: o de --certificate ou o do repositório, se existir. */
function findCertificate(root, explicit) {
  if (explicit) return path.resolve(explicit);
  const file = path.join(root, ...CERTIFICATE.split('/'));
  return fs.existsSync(file) ? file : undefined;
}

/** Uma chave que não é a do certificado faz todo aparelho recusar o update, em silêncio. */
function assertKeyMatchesCertificate(key, certificatePem, label) {
  let publicKey;
  try {
    publicKey = new crypto.X509Certificate(certificatePem).publicKey;
  } catch {
    throw new Error(`${label} não é um certificado X.509 em PEM.`);
  }
  const probe = Buffer.from('aouerj-ota', 'utf8');
  const signature = Buffer.from(signRsaSha256('aouerj-ota', key), 'base64');
  const matches = crypto.verify(
    'sha256',
    probe,
    { key: publicKey, padding: crypto.constants.RSA_PKCS1_PADDING },
    signature,
  );
  if (!matches)
    throw new Error(
      `A chave de assinatura não é a do certificado ${label}: os aparelhos recusariam o update.`,
    );
}

/** Uma linha do PEM da chave, nos dois formatos: nada do que é enviado pode contê-la. */
function keyFragments(key) {
  return ['pkcs8', 'pkcs1'].map(type =>
    Buffer.from(key.export({ type, format: 'pem' }).split('\n')[2], 'utf8'),
  );
}

function assertNoKeyInside(files, key) {
  const fragments = keyFragments(key);
  for (const file of files)
    if (fragments.some(fragment => file.bytes.includes(fragment)))
      throw new Error(
        `${file.path} contém a chave de assinatura, e nada foi enviado. Tire-a do código e troque a chave (docs/ota.md).`,
      );
}

/** O ambiente dos processos filhos, sem a chave. */
function childEnv(env) {
  // sem o .env: o Expo o carregaria e exportaria para o Metro (no QA local, ele
  // tem a matrícula e a senha do diagnóstico do portal)
  const copy = { ...env, EXPO_NO_TELEMETRY: '1', EXPO_NO_DOTENV: '1' };
  delete copy[KEY_ENV];
  return copy;
}

/** O runtime que uma build da loja feita deste código embute. */
function currentRuntimeVersion(platform, root = ROOT, env = process.env) {
  const script = path.join(root, 'scripts', 'ota', 'runtime-version.cjs');
  if (!fs.existsSync(script))
    throw new Error(
      'Falta o scripts/ota/runtime-version.cjs, que calcula o runtime version.',
    );
  let output;
  try {
    output = execFileSync(process.execPath, [script, platform], {
      cwd: root,
      env: childEnv(env),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'inherit'],
    });
  } catch (error) {
    throw new Error(
      `O runtime-version.cjs falhou para ${platform} (saída ${error.status ?? error.signal}).`,
    );
  }
  return validateRuntimeVersion(output.trim(), `O runtime de ${platform}`);
}

function expoCli(root) {
  // nodeLinker: hoisted, então o pacote fica na raiz do node_modules
  const manifest = path.join(root, 'node_modules', 'expo', 'package.json');
  if (!fs.existsSync(manifest))
    throw new Error('O pacote expo não está instalado: rode pnpm install.');
  const { bin } = JSON.parse(fs.readFileSync(manifest, 'utf8'));
  const cli = typeof bin === 'string' ? bin : bin?.expo;
  if (!cli) throw new Error('O pacote expo não declara a CLI (bin.expo).');
  return path.join(path.dirname(manifest), cli);
}

/** `expo export` de uma plataforma: metadata.json, _expo/static/js/<plataforma>/ e assets/. */
function exportUpdate(platform, outputDir, root = ROOT, env = process.env) {
  const result = spawnSync(
    process.execPath,
    [
      expoCli(root),
      'export',
      '--platform',
      platform,
      '--output-dir',
      outputDir,
    ],
    { cwd: root, env: childEnv(env), stdio: ['ignore', 'inherit', 'inherit'] },
  );
  if (result.error)
    throw new Error(`O expo export não rodou: ${result.error.message}`);
  if (result.status !== 0)
    throw new Error(
      `O expo export de ${platform} falhou (saída ${result.status ?? result.signal}).`,
    );
  return outputDir;
}

function resolveRuntimes(platforms, { rollback, runtimeVersions }, compute) {
  const runtimes = {};
  for (const platform of platforms) {
    const requested = runtimeVersions[platform] ?? runtimeVersions['*'];
    if (rollback && requested !== undefined) {
      runtimes[platform] = validateRuntimeVersion(
        requested,
        `O --runtime-version de ${platform}`,
      );
      continue;
    }
    const current = validateRuntimeVersion(
      compute(platform),
      `O runtime de ${platform}`,
    );
    if (requested !== undefined && requested !== current)
      throw new Error(
        `Este código é do runtime ${current} em ${platform}, não do ${requested}: o nativo mudou, e o update não serviria para a build da loja. Isso pede uma release na loja (docs/ota.md).`,
      );
    runtimes[platform] = current;
  }
  return runtimes;
}

function prepareOutDir(outDir, mkdtemp) {
  if (!outDir) return { dir: mkdtemp(), temporary: true };
  const dir = path.resolve(outDir);
  if (fs.existsSync(dir) && fs.readdirSync(dir).length)
    throw new Error(`A --out-dir ${dir} não está vazia.`);
  fs.mkdirSync(dir, { recursive: true });
  return { dir, temporary: false };
}

function readMetadata(exportDir) {
  const file = path.join(exportDir, 'metadata.json');
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    throw new Error(
      error.code === 'ENOENT'
        ? `O export em ${exportDir} não tem metadata.json.`
        : `O metadata.json do export não é JSON válido.`,
    );
  }
}

/** Uma requisição; os PUTs dos assets (idempotentes) repetem em falha de rede, 429 e 5xx. */
async function send(request, { fetch, sleep, attempts = 1 }) {
  for (let attempt = 1; ; attempt += 1) {
    const retry = attempt < attempts;
    let response;
    try {
      response = await fetch(request.url, {
        method: request.method,
        headers: request.headers,
        body: request.body,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      if (retry) {
        await sleep(attempt * 2000);
        continue;
      }
      throw new Error(
        `${request.method} ${request.url}: sem resposta (${error.cause?.code ?? error.message}).`,
      );
    }
    if (response.ok) return;
    const detail = (await response.text().catch(() => ''))
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 300);
    if (retry && (response.status >= 500 || response.status === 429)) {
      await sleep(attempt * 2000);
      continue;
    }
    throw new Error(
      `${request.method} ${request.url} respondeu ${response.status}${detail ? `: ${detail}` : ''}.`,
    );
  }
}

/** Roda `worker` em até `lanes` itens por vez; na primeira falha, não começa mais nenhum. */
async function eachInLanes(items, lanes, worker) {
  let next = 0;
  let failed = false;
  const lane = async () => {
    while (!failed && next < items.length) {
      const item = items[next];
      next += 1;
      try {
        await worker(item);
      } catch (error) {
        failed = true;
        throw error;
      }
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(lanes, items.length) }, lane),
  );
}

function writeDryRun(dir, { uploads, finals, documents, ephemeralPublicKey }) {
  for (const [name, content] of documents) {
    fs.mkdirSync(path.dirname(path.join(dir, name)), { recursive: true });
    fs.writeFileSync(path.join(dir, name), content);
  }
  const describe = request =>
    Buffer.isBuffer(request.body)
      ? {
          method: request.method,
          url: request.url,
          headers: request.headers,
          bodyFile: request.file,
          bytes: request.body.length,
        }
      : {
          method: request.method,
          url: request.url,
          headers: request.headers,
          body: request.body,
        };
  fs.writeFileSync(
    path.join(dir, 'requests.json'),
    `${JSON.stringify([...uploads, ...finals].map(describe), null, 2)}\n`,
  );
  if (ephemeralPublicKey)
    fs.writeFileSync(
      path.join(dir, 'ephemeral-public-key.pem'),
      ephemeralPublicKey,
    );
}

/**
 * Exporta, monta, assina e envia (ou grava, no dry-run). `deps` troca as
 * partes com efeito (export, runtime, rede, relógio) nos testes.
 */
async function publish(options, deps = {}) {
  const {
    root = ROOT,
    env = process.env,
    log = message => console.log(message),
    warn = message => console.warn(annotate('warning', message)),
    now = () => new Date(),
    randomUUID = () => crypto.randomUUID(),
    runtimeVersion = platform => currentRuntimeVersion(platform, root, env),
    runExport = (platform, dir) => exportUpdate(platform, dir, root, env),
    fetch = globalThis.fetch,
    sleep = ms => new Promise(resolve => setTimeout(resolve, ms)),
    mkdtemp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'aouerj-ota-')),
  } = deps;
  const platforms = options.platforms ?? [];
  if (!platforms.length)
    throw new Error('Informe --platform android, ios ou both.');
  const baseUrl = normalizeBaseUrl(options.baseUrl ?? DEFAULT_BASE_URL);
  const signing = loadSigningKey(options, env);
  if (signing.ephemeralPublicKey) {
    warn(
      'Sem chave: o dry-run assina com uma chave descartável, que nenhum aparelho aceita.',
    );
  } else {
    const certificate = findCertificate(root, options.certificate);
    if (certificate) {
      const label = path.relative(root, certificate) || certificate;
      let pem;
      try {
        pem = fs.readFileSync(certificate, 'utf8');
      } catch {
        throw new Error(`Não deu para ler o certificado ${label}.`);
      }
      assertKeyMatchesCertificate(signing.key, pem, label);
    } else
      warn(
        `Sem o certificado do app (${CERTIFICATE} ou --certificate): a chave não foi conferida.`,
      );
  }
  const runtimes = resolveRuntimes(
    platforms,
    {
      rollback: options.rollback,
      runtimeVersions: options.runtimeVersions ?? {},
    },
    runtimeVersion,
  );
  if (options.message) log(`Mensagem: ${options.message}`);

  const out = prepareOutDir(options.outDir, mkdtemp);
  try {
    const createdAt = now().toISOString();
    const finals = [];
    const documents = [];
    const files = new Map();
    const updates = [];
    for (const platform of platforms) {
      const runtime = runtimes[platform];
      if (options.rollback) {
        const request = directiveRequest(
          baseUrl,
          {
            platform,
            runtimeVersion: runtime,
            directive: rollbackDirective(createdAt),
          },
          signing.key,
        );
        const { directive, signature } = JSON.parse(request.body);
        finals.push(request);
        documents.push(
          [`${platform}/directive.json`, directive],
          [`${platform}/directive.sig`, signature],
        );
        updates.push({ platform, runtimeVersion: runtime, rollback: true });
        continue;
      }
      const exportDir = options.exportDir
        ? path.resolve(options.exportDir)
        : runExport(platform, path.join(out.dir, `export-${platform}`));
      const plan = planUpdate({
        platform,
        runtimeVersion: runtime,
        metadata: readMetadata(exportDir),
        readFile: relative => fs.readFileSync(exportFile(exportDir, relative)),
        baseUrl,
        id: randomUUID(),
        createdAt,
      });
      if (!plan.manifest.assets.length)
        warn(
          `O export de ${platform} não tem nenhum asset: confira se o metro.config.js estende o expo/metro-config (sem ele, as imagens ficam fora do update).`,
        );
      for (const file of plan.files)
        if (!files.has(file.hash))
          files.set(file.hash, {
            ...file,
            file: exportFile(exportDir, file.path),
          });
      const request = updateRequest(baseUrl, plan, signing.key);
      const { manifest, signature } = JSON.parse(request.body);
      finals.push(request);
      documents.push(
        [`${platform}/manifest.json`, manifest],
        [`${platform}/manifest.sig`, signature],
      );
      updates.push({
        platform,
        runtimeVersion: runtime,
        id: plan.manifest.id,
        assets: plan.manifest.assets.length,
      });
    }
    assertNoKeyInside([...files.values()], signing.key);
    const uploads = [...files.values()].map(file => ({
      ...assetRequest(baseUrl, file, signing.key),
      file: file.file,
    }));
    const what = options.rollback ? 'diretiva(s)' : 'manifest(s)';

    if (options.dryRun) {
      writeDryRun(out.dir, {
        uploads,
        finals,
        documents,
        ephemeralPublicKey: signing.ephemeralPublicKey,
      });
      log(
        `Dry-run em ${out.dir}: ${uploads.length} arquivo(s) e ${finals.length} ${what}, nada enviado.`,
      );
      return { dryRun: true, outDir: out.dir, updates };
    }

    log(`Enviando ${uploads.length} arquivo(s) para ${baseUrl}.`);
    await eachInLanes(uploads, UPLOAD_LANES, request =>
      send(request, { fetch, sleep, attempts: UPLOAD_ATTEMPTS }),
    );
    // sem repetir: um POST que o servidor gravou e não respondeu publicaria duas vezes
    for (const request of finals) await send(request, { fetch, sleep });
    for (const update of updates)
      log(
        update.rollback
          ? `${update.platform}: volta ao JS da loja publicada (runtime ${update.runtimeVersion}).`
          : `${update.platform}: update ${update.id} publicado (runtime ${update.runtimeVersion}, ${update.assets} asset(s)).`,
      );
    return { dryRun: false, updates };
  } finally {
    if (out.temporary && !options.dryRun)
      fs.rmSync(out.dir, { recursive: true, force: true });
  }
}

function parseArgs(argv) {
  const options = {
    platforms: [],
    rollback: false,
    dryRun: false,
    runtimeVersions: {},
  };
  for (let index = 0; index < argv.length; index += 1) {
    let name = argv[index];
    let inline;
    const equals = name.indexOf('=');
    if (name.startsWith('--') && equals !== -1) {
      inline = name.slice(equals + 1);
      name = name.slice(0, equals);
    }
    const value = () => {
      if (inline !== undefined) return inline;
      const next = argv[index + 1];
      if (next === undefined || next.startsWith('--'))
        throw new Error(`${name} precisa de um valor.`);
      index += 1;
      return next;
    };
    const flag = () => {
      if (inline !== undefined) throw new Error(`${name} não leva valor.`);
      return true;
    };
    switch (name) {
      case '--platform': {
        const platform = value();
        if (platform === 'both') options.platforms = [...PLATFORMS];
        else if (PLATFORMS.includes(platform)) options.platforms = [platform];
        else
          throw new Error(
            `Plataforma desconhecida: ${platform} (android, ios ou both).`,
          );
        break;
      }
      case '--runtime-version': {
        const runtime = value();
        const scoped = /^(android|ios)=(.*)$/.exec(runtime);
        if (scoped) options.runtimeVersions[scoped[1]] = scoped[2];
        else options.runtimeVersions['*'] = runtime;
        break;
      }
      case '--rollback':
        options.rollback = flag();
        break;
      case '--dry-run':
        options.dryRun = flag();
        break;
      case '--out-dir':
        options.outDir = value();
        break;
      case '--export-dir':
        options.exportDir = value();
        break;
      case '--base-url':
        options.baseUrl = value();
        break;
      case '--key-file':
        options.keyFile = value();
        break;
      case '--certificate':
        options.certificate = value();
        break;
      case '--message':
        options.message = value().trim();
        break;
      case '--help':
      case '-h':
        options.help = flag();
        break;
      default:
        throw new Error(`Opção desconhecida: ${name} (veja --help).`);
    }
  }
  if (options.rollback && options.exportDir)
    throw new Error('--export-dir não serve para --rollback.');
  return options;
}

function summaryMarkdown({ updates }, { message, rollback }) {
  const rows = updates.map(update =>
    update.rollback
      ? `| ${update.platform} | \`${update.runtimeVersion}\` | volta ao JS da loja |`
      : `| ${update.platform} | \`${update.runtimeVersion}\` | \`${update.id}\` (${update.assets} asset(s)) |`,
  );
  return [
    `### OTA: ${rollback ? 'volta ao JS da loja' : 'update'}`,
    '',
    ...(message ? [message, ''] : []),
    '| Plataforma | Runtime | Publicado |',
    '| --- | --- | --- |',
    ...rows,
    '',
  ].join('\n');
}

const USAGE = `Uso: node scripts/ota/publish.cjs --platform <android|ios|both> [--rollback]
  [--dry-run] [--out-dir <pasta>] [--export-dir <pasta>] [--base-url <url>]
  [--runtime-version [<plataforma>=]<valor>] [--key-file <pem>]
  [--certificate <pem>] [--message <texto>]
A chave vem de OTA_SIGNING_KEY ou de --key-file. Ver docs/ota.md.`;

async function main(argv, env = process.env) {
  const options = parseArgs(argv);
  if (options.help) {
    console.log(USAGE);
    return;
  }
  const result = await publish(options, { env });
  if (env.GITHUB_STEP_SUMMARY && !result.dryRun)
    fs.appendFileSync(
      env.GITHUB_STEP_SUMMARY,
      summaryMarkdown(result, options),
    );
}

if (require.main === module) {
  main(process.argv.slice(2)).catch(error => {
    console.error(annotate('error', error?.message ?? String(error)));
    process.exitCode = 1;
  });
}

module.exports = {
  CERTIFICATE,
  DEFAULT_BASE_URL,
  KEY_ENV,
  PLATFORMS,
  ROUTES,
  assertKeyMatchesCertificate,
  assertNoKeyInside,
  assetRequest,
  buildManifest,
  childEnv,
  contentTypeFor,
  currentRuntimeVersion,
  describeAsset,
  directiveRequest,
  exportFile,
  md5,
  normalizeBaseUrl,
  parseArgs,
  parsePrivateKey,
  planUpdate,
  publish,
  readExportMetadata,
  rollbackDirective,
  sha256,
  signRsaSha256,
  updateRequest,
  validateRuntimeVersion,
};
