#!/usr/bin/env bash
#
# Prepara a VM para a implantação automática do servidor. Roda uma vez, como
# ubuntu, de dentro de uma cópia de deploy/server; rodar de novo não refaz o
# que já existe. Não mexe no tráfego: os apps continuam no server-pitroldev e
# no class-schedule-generator até o cutover.sh, que os aposenta.
#
#   bash bootstrap.sh "<chave pública ssh-ed25519 do CI>"
#
# O que faz:
#   - Node 22 em ~/ao-uerj-server/node (o do sistema, 18, segue com os outros
#     processos do pm2), conferido pelo SHASUMS256 do nodejs.org, com um
#     Corepack que roda o pnpm 12;
#   - um clone parcial do repositório público em ~/ao-uerj-server/repo.git;
#   - ~/ao-uerj-server/shared/.env com o MONGODB_URI do server-pitroldev (sem
#     passar pela tela) e um ADMIN_TOKEN novo;
#   - ~/ao-uerj-server/shared/AOreports com uma cópia dos anexos dos relatos
#     (o cutover copia de novo o que chegar até a troca);
#   - o upstream do nginx (conf.d), sem uso até o cutover;
#   - o pm2 no boot (systemd), que hoje não existe: um reboot derrubava tudo;
#   - o logrotate (a imagem mínima da Oracle não o traz), que passa a girar os
#     logs do pm2 e os do nginx, até então sem fim;
#   - ~/ao-uerj-server/bin/remote e a chave do CI no authorized_keys, presa a ele.
set -euo pipefail

CI_KEY="${1:?uso: bootstrap.sh \"<chave pública do CI>\"}"
[[ "$CI_KEY" =~ ^ssh-ed25519\ [A-Za-z0-9+/=]+(\ .*)?$ ]] ||
  { echo 'a chave precisa ser ssh-ed25519'; exit 64; }

HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$HOME/ao-uerj-server"
NODE_VERSION=v22.21.1
COREPACK_VERSION=0.34.7
LEGACY="$HOME/server-pitroldev"
REPORTS="$ROOT/shared/AOreports"
# o ensaio local usa uma cópia; na VM, o repositório público
REPO="${AO_UERJ_REPO:-https://github.com/pitroldev/ao-uerj-mobile-ts.git}"
# os testes (deploy/server/test) trocam o /etc e o logrotate por pastas próprias
ETC="${AO_UERJ_ETC:-/etc}"
UPSTREAM="$ETC/nginx/conf.d/ao-uerj-upstream.conf"

log() { printf '[bootstrap] %s\n' "$*"; }

mkdir -p "$ROOT"/{releases,shared,state,bin}

if [ ! -x "$ROOT/node/bin/node" ]; then
  log "baixando o Node $NODE_VERSION"
  tmp="$(mktemp -d)"
  tarball="node-$NODE_VERSION-linux-x64.tar.xz"
  curl -fsSL "https://nodejs.org/dist/$NODE_VERSION/$tarball" -o "$tmp/$tarball"
  curl -fsSL "https://nodejs.org/dist/$NODE_VERSION/SHASUMS256.txt" -o "$tmp/SHASUMS256.txt"
  (cd "$tmp" && grep " $tarball\$" SHASUMS256.txt | sha256sum -c --quiet -)
  mkdir -p "$ROOT/node"
  tar -xJf "$tmp/$tarball" -C "$ROOT/node" --strip-components=1
  rm -rf "$tmp"
fi
log "node $("$ROOT/node/bin/node" -v)"

# o pnpm 12 exige Corepack 0.34.5 ou mais novo; o que vem no Node 22.21 é mais
# velho e procura um bin/pnpm.cjs que o pnpm 12 não tem
if [ "$("$ROOT/node/bin/corepack" --version)" != "$COREPACK_VERSION" ]; then
  log "instalando o Corepack $COREPACK_VERSION"
  PATH="$ROOT/node/bin:$PATH" "$ROOT/node/bin/npm" install --global \
    --no-fund --no-audit --loglevel=error "corepack@$COREPACK_VERSION"
fi

if [ ! -d "$ROOT/repo.git" ]; then
  log 'clonando o repositório (só a história; os arquivos vêm sob demanda)'
  git clone --quiet --bare --filter=blob:none "$REPO" "$ROOT/repo.git"
fi

# os anexos têm dados pessoais (os relatos da 1.x trazem a página do portal)
(umask 077 && mkdir -p "$REPORTS")
if [ -d "$LEGACY/AOreports" ]; then
  log 'copiando os anexos dos relatos (sem sobrescrever)'
  cp -an "$LEGACY/AOreports/." "$REPORTS/"
fi
# o `cp -a origem/.` leva as permissões da pasta de origem junto
chmod 700 "$REPORTS"

if [ ! -f "$ROOT/shared/.env" ]; then
  log 'criando shared/.env'
  grep -q '^MONGODB_URI=' "$LEGACY/.env" ||
    { echo "sem MONGODB_URI em $LEGACY/.env"; exit 1; }
  (
    umask 077
    {
      echo 'NODE_ENV=production'
      echo 'HOST=127.0.0.1'
      grep '^MONGODB_URI=' "$LEGACY/.env"
      echo 'TRUST_PROXY=1'
      echo "REPORTS_DIR=$REPORTS"
      echo "ADMIN_TOKEN=$(openssl rand -hex 24)"
      echo 'PORTAL_MONITOR=on'
    } >"$ROOT/shared/.env"
  )
fi

if [ ! -f "$UPSTREAM" ]; then
  log "criando $UPSTREAM (sem uso até o cutover)"
  printf 'upstream ao_uerj_server {\n  server 127.0.0.1:3101;\n}\n' |
    sudo -n tee "$UPSTREAM" >/dev/null
  # a implantação troca a porta sem sudo; o teste e o reload do nginx usam sudo
  sudo -n chown "$USER" "$UPSTREAM"
  sudo -n nginx -t -q
fi

# Sem a unidade do systemd, um reboot da VM não traz processo nenhum de volta
# (nem os antigos). O daemon segue com o Node do sistema, como hoje.
# (sem `| grep -q`: com o pipefail, o grep que sai cedo derruba o systemctl
# com SIGPIPE, e a condição dava falso sempre)
if ! systemctl is-enabled --quiet "pm2-$USER.service" 2>/dev/null; then
  log 'ligando o pm2 no boot (systemd)'
  sudo -n env PATH="$PATH:/usr/bin" "$(command -v pm2)" startup systemd \
    -u "$USER" --hp "$HOME" >/dev/null
  pm2 save --force >/dev/null
fi

# Os logs do pm2 crescem sem fim (uma linha por requisição). O logrotate do
# sistema gira por dia, guarda 14 compactados e não custa um processo a mais
# (o pm2-logrotate custaria uns 40 MB numa VM de 1 GB). A imagem mínima da
# Oracle não o traz; com ele, o /etc/logrotate.d/nginx do pacote do nginx
# passa a valer também: 14 dias de log do nginx (com os IPs), não mais tudo.
ROTATE="$ETC/logrotate.d/pm2-$USER"
LOGROTATE="${AO_UERJ_LOGROTATE:-/usr/sbin/logrotate}"
if [ ! -x "$LOGROTATE" ]; then
  log 'instalando o logrotate'
  sudo -n env DEBIAN_FRONTEND=noninteractive \
    apt-get install -y --no-install-recommends logrotate >/dev/null
fi
if [ ! -f "$ROTATE" ]; then
  log 'girando os logs do pm2 (logrotate)'
  printf '%s\n' \
    "$HOME/.pm2/pm2.log $HOME/.pm2/logs/*.log {" \
    "  su $USER $USER" \
    '  daily' \
    '  rotate 14' \
    '  missingok' \
    '  notifempty' \
    '  compress' \
    '  delaycompress' \
    '  copytruncate' \
    '}' | sudo -n tee "$ROTATE" >/dev/null
  sudo -n "$LOGROTATE" --debug "$ROTATE" >/dev/null 2>&1 ||
    { sudo -n rm -f "$ROTATE"; echo 'o logrotate recusou a configuração'; exit 1; }
fi

install -m 755 "$HERE/remote.sh" "$ROOT/bin/remote"

mkdir -p "$HOME/.ssh" && chmod 700 "$HOME/.ssh"
touch "$HOME/.ssh/authorized_keys" && chmod 600 "$HOME/.ssh/authorized_keys"
key_body="$(echo "$CI_KEY" | cut -d' ' -f2)"
if ! grep -qF "$key_body" "$HOME/.ssh/authorized_keys"; then
  log 'autorizando a chave do CI (só o bin/remote)'
  printf 'command="%s",restrict %s\n' "$ROOT/bin/remote" "$CI_KEY" >>"$HOME/.ssh/authorized_keys"
fi

log 'pronto'
