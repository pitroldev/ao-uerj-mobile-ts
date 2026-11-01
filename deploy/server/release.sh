#!/usr/bin/env bash
#
# Sobe uma versão do servidor ao lado da que está no ar (azul/verde) e só
# troca o tráfego depois de conferir. Qualquer falha antes da troca deixa a
# versão no ar como estava; uma falha depois dela volta o nginx para a anterior.
#
#   release.sh <sha>      (chamado pelo remote.sh, com a trava já tomada)
#
# Na VM (ver bootstrap.sh):
#   ~/ao-uerj-server/node/            Node 22 só deste servidor
#   ~/ao-uerj-server/releases/<sha>/  server/ e deploy/ daquele commit
#   ~/ao-uerj-server/shared/.env      a configuração de produção
#   ~/ao-uerj-server/state/           a cor ativa, o sha de cada cor, o histórico
#   /etc/nginx/conf.d/ao-uerj-upstream.conf   a porta que o nginx usa
set -euo pipefail

SHA="${1:?uso: release.sh <sha>}"
ROOT="${AO_UERJ_ROOT:-$HOME/ao-uerj-server}"
RELEASE="$ROOT/releases/$SHA"
STATE="$ROOT/state"
UPSTREAM=/etc/nginx/conf.d/ao-uerj-upstream.conf
SITE=/etc/nginx/sites-enabled/default
KEEP_RELEASES=5
SYSTEM_PATH="$PATH"
export PATH="$ROOT/node/bin:$PATH"
export COREPACK_ENABLE_DOWNLOAD_PROMPT=0

# o pm2 (CLI e daemon) segue com o Node do sistema, como os outros processos;
# só o servidor roda no Node 22 (--interpreter)
pm2() { PATH="$SYSTEM_PATH" command pm2 "$@"; }

log() { printf '[implantação %s] %s\n' "$(date -u +%H:%M:%S)" "$*"; }
port_of() { if [ "$1" = blue ]; then echo 3101; else echo 3102; fi; }

active="$(cat "$STATE/active" 2>/dev/null || echo none)"
next=blue
[ "$active" = blue ] && next=green
port="$(port_of "$next")"
name="ao-uerj-$next"

# A troca de tráfego só existe depois do cutover.sh (o nginx usa o upstream).
switched=false
grep -q 'ao-uerj-proxy.conf' "$SITE" && switched=true

# O fim do log da versão que falhou, para o log do CI. O repositório é
# público: de cada linha saem só o nível, a mensagem e a classe do erro, nunca
# o texto dele (que pode trazer o endereço do banco). O log inteiro fica na
# VM: pm2 logs ao-uerj-<cor>. (O `${...}` é do JavaScript.)
# shellcheck disable=SC2016
recent_log() {
  pm2 logs "$name" --lines 40 --nostream --raw 2>/dev/null | node -e '
    let text = "";
    process.stdin.on("data", chunk => (text += chunk)).on("end", () => {
      for (const line of text.split("\n")) {
        const at = line.indexOf("{");
        try {
          const entry = JSON.parse(line.slice(at));
          const error = entry.err?.type ?? entry.err?.name ?? "";
          console.log(`  log: ${entry.level} ${entry.msg ?? ""} ${error}`.trimEnd());
        } catch {
          const error = /\b([A-Z]\w*Error)\b/.exec(line)?.[1];
          if (error) console.log(`  log: (fora do JSON) ${error}`);
        }
      }
    });' || true
}

abandon() {
  log "$1; a versão no ar continua sendo a $active"
  recent_log
  pm2 delete "$name" >/dev/null 2>&1 || true
  exit 1
}

log "versão $SHA, cor $next (porta $port); no ar: $active; tráfego pelo upstream: $switched"

log 'instalando as dependências'
(cd "$RELEASE/server" &&
  corepack pnpm install --prod --frozen-lockfile --ignore-workspace \
    --reporter=append-only) || abandon 'a instalação falhou'
ln -sfn "$ROOT/shared/.env" "$RELEASE/server/.env"

log "subindo $name"
pm2 delete "$name" >/dev/null 2>&1 || true
# o commit e a cor aparecem no GET /aouerj/status
PORT="$port" HOST=127.0.0.1 RELEASE_COMMIT="$SHA" RELEASE_COLOR="$next" \
  pm2 start "$RELEASE/server/src/main.ts" \
  --name "$name" \
  --cwd "$RELEASE/server" \
  --interpreter "$ROOT/node/bin/node" \
  --node-args='--env-file-if-exists=.env' \
  --kill-timeout 15000 \
  --max-memory-restart 400M \
  --time >/dev/null || abandon 'o pm2 não subiu o processo'

log 'conferindo a versão nova direto na porta'
node "$RELEASE/deploy/server/smoke.mjs" "http://127.0.0.1:$port" \
  --wait 60 --require-database --expect-commit "$SHA" ||
  abandon 'a versão nova não passou na conferência'

if [ "$switched" = true ]; then
  previous_upstream="$(cat "$UPSTREAM")"
  restore_upstream() {
    printf '%s\n' "$previous_upstream" >"$UPSTREAM"
    sudo -n nginx -t -q && sudo -n systemctl reload nginx
  }

  log "trocando o nginx para a porta $port"
  printf 'upstream ao_uerj_server {\n  server 127.0.0.1:%s;\n}\n' "$port" >"$UPSTREAM"
  if ! sudo -n nginx -t -q || ! sudo -n systemctl reload nginx; then
    restore_upstream || true
    abandon 'o nginx recusou a troca'
  fi

  log 'conferindo pelo nginx (o caminho dos apps)'
  sleep 1
  if ! node "$RELEASE/deploy/server/smoke.mjs" https://pitrol.dev \
    --via 127.0.0.1 --require-database --expect-commit "$SHA"; then
    restore_upstream || true
    abandon 'a versão nova falhou pelo nginx; o nginx voltou para a anterior'
  fi
fi

if [ "$active" != none ] && [ "$active" != "$next" ]; then
  log "encerrando ao-uerj-$active (as requisições em andamento terminam)"
  pm2 delete "ao-uerj-$active" >/dev/null 2>&1 || true
fi
pm2 save --force >/dev/null

mkdir -p "$STATE"
printf '%s\n' "$next" >"$STATE/active"
printf '%s\n' "$SHA" >"$STATE/$next.sha"
printf '%s %s %s\n' "$(date -u +%FT%TZ)" "$SHA" "$next" >>"$STATE/history"

# guarda as últimas versões (a volta usa a anterior); apaga o resto. Os
# nomes são shas, então o ls basta.
# shellcheck disable=SC2012
ls -1t "$ROOT/releases" | tail -n +$((KEEP_RELEASES + 1)) | while read -r old; do
  [ "$old" = "$SHA" ] || rm -rf "${ROOT:?}/releases/$old"
done

if [ "$switched" = true ]; then
  log "pronto: $SHA no ar ($next, porta $port)"
  echo 'traffic=switched'
else
  log "pronto: $SHA rodando em $next (porta $port), ainda sem tráfego: falta o cutover.sh"
  echo 'traffic=pending'
fi
