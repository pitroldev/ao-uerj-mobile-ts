#!/usr/bin/env bash
#
# A troca de uma vez só: o nginx deixa o server-pitroldev (porta 3000) e o
# class-schedule-generator (porta 3333) e passa a mandar /aouerj/ e
# /schedules/ para o servidor novo, já implantado e conferido. Depois de
# conferir pelo nginx, copia os anexos que chegaram e aposenta os dois
# processos antigos no pm2 (as pastas deles ficam no disco).
#
#   bash cutover.sh          troca e confere pelo nginx; se falhar, desfaz
#   bash cutover.sh --undo   volta o nginx e os processos antigos
#
# Roda como ubuntu, de dentro de deploy/server de uma versão implantada.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$HOME/ao-uerj-server"
STATE="$ROOT/state"
# os testes (deploy/server/test) trocam o /etc por uma pasta própria
ETC="${AO_UERJ_ETC:-/etc}"
# o arquivo que o nginx carrega de fato (o sites-enabled costuma ser um link)
SITE="$(readlink -f "$ETC/nginx/sites-enabled/default")"
SNIPPET="$ETC/nginx/snippets/ao-uerj-proxy.conf"
BACKUP="$STATE/nginx-default.before-cutover"
LEGACY_APPS="$STATE/legacy-apps.tsv"
LEGACY_REPORTS="$HOME/server-pitroldev/AOreports"
REPORTS="$ROOT/shared/AOreports"
SYSTEM_PATH="$PATH"
export PATH="$ROOT/node/bin:$PATH"

log() { printf '[cutover] %s\n' "$*"; }
reload() { sudo -n nginx -t -q && sudo -n systemctl reload nginx; }
# o pm2 segue com o Node do sistema, como o daemon e os processos antigos
pm2() { PATH="$SYSTEM_PATH" command pm2 "$@"; }

# o script e a pasta de cada processo antigo, para o --undo (o `${...}` é do
# JavaScript, não do shell)
# shellcheck disable=SC2016
app_line() {
  pm2 jlist | node -e '
    let text = "";
    process.stdin.on("data", chunk => (text += chunk)).on("end", () => {
      const app = JSON.parse(text).find(entry => entry.name === process.argv[1]);
      if (app) console.log(`${app.name}\t${app.pm2_env.pm_exec_path}\t${app.pm2_env.pm_cwd}`);
    });' "$1"
}

if [ "${1:-}" = --undo ]; then
  [ -f "$BACKUP" ] || { echo "sem cópia em $BACKUP"; exit 1; }
  if [ -f "$LEGACY_APPS" ]; then
    while IFS=$'\t' read -r app script cwd; do
      pm2 describe "$app" >/dev/null 2>&1 && continue
      log "subindo de novo $app"
      pm2 start "$script" --name "$app" --cwd "$cwd" >/dev/null
    done <"$LEGACY_APPS"
    pm2 save --force >/dev/null
    sleep 2
  fi
  sudo -n cp "$BACKUP" "$SITE"
  reload
  # o reload só sinaliza o nginx; a configuração vale um instante depois
  sleep 2
  log 'o nginx voltou para o servidor antigo (portas 3000 e 3333)'
  exit 0
fi

grep -q 'ao-uerj-proxy.conf' "$SITE" && { log 'o cutover já foi feito'; exit 0; }

active="$(cat "$STATE/active" 2>/dev/null || true)"
[ -n "$active" ] || { echo 'nenhuma versão implantada: rode a implantação antes'; exit 1; }
port=3101
[ "$active" = green ] && port=3102
commit="$(cat "$STATE/$active.sha")"

log "conferindo a versão ativa ($active, porta $port) antes de trocar"
node "$HERE/smoke.mjs" "http://127.0.0.1:$port" --require-database \
  --expect-commit "$commit"

# exatamente as quatro linhas esperadas (dois blocos server, 80 e 443)
aouerj='proxy_pass http://localhost:3000/aouerj/;'
schedules='proxy_pass http://localhost:3333/;'
[ "$(grep -cF "$aouerj" "$SITE")" = 2 ] || { echo "esperava 2 linhas '$aouerj'"; exit 1; }
[ "$(grep -cF "$schedules" "$SITE")" = 2 ] || { echo "esperava 2 linhas '$schedules'"; exit 1; }

cp "$SITE" "$BACKUP"
sudo -n install -m 644 "$HERE/nginx-proxy.conf" "$SNIPPET"
sudo -n sed -i \
  -e "s#$aouerj#include snippets/ao-uerj-proxy.conf;#" \
  -e "s#$schedules#include snippets/ao-uerj-proxy.conf;#" \
  "$SITE"

undo() {
  log "$1; desfazendo"
  sudo -n cp "$BACKUP" "$SITE"
  reload || true
  exit 1
}

reload || undo 'o nginx recusou a configuração'
sleep 1
log 'conferindo pelo nginx (o caminho dos apps)'
node "$HERE/smoke.mjs" https://pitrol.dev --via 127.0.0.1 --require-database \
  --expect-commit "$commit" || undo 'a conferência pelo nginx falhou'

# o `cp -a origem/.` leva as permissões da pasta de origem junto
copy_reports() {
  [ -d "$LEGACY_REPORTS" ] || return 0
  cp -an "$LEGACY_REPORTS/." "$REPORTS/"
  chmod 700 "$REPORTS"
}

log 'copiando os anexos que chegaram ao servidor antigo até a troca'
copy_reports

log 'aposentando o server-pitroldev e o class-schedule-generator no pm2'
: >"$LEGACY_APPS"
for app in ao-uerj uerj-generator; do
  line="$(app_line "$app")"
  [ -n "$line" ] || continue
  printf '%s\n' "$line" >>"$LEGACY_APPS"
  pm2 delete "$app" >/dev/null
done
pm2 save --force >/dev/null
# o que tenha chegado nos últimos segundos, antes de o processo sair
copy_reports

log 'pronto: os apps falam com o servidor novo, e os antigos saíram do pm2'
log "as pastas deles ficam no disco; voltar é 'cutover.sh --undo'"
