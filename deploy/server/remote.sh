#!/usr/bin/env bash
#
# A única coisa que a chave do CI pode fazer na VM: o authorized_keys a prende
# a este script (command=..., sem shell, sem túnel). O pedido vem em
# SSH_ORIGINAL_COMMAND:
#
#   deploy <sha>   implanta um commit que esteja na main do GitHub
#   rollback       volta para a versão anterior
#   status         a cor ativa, as versões e os processos
#
# O bootstrap.sh copia este arquivo para ~/ao-uerj-server/bin/remote. O resto
# (release.sh, smoke.mjs) vem do próprio commit implantado.
set -euo pipefail

ROOT="$HOME/ao-uerj-server"
STATE="$ROOT/state"
SYSTEM_PATH="$PATH"
export PATH="$ROOT/node/bin:$PATH"
# o pm2 segue com o Node do sistema, como o daemon
pm2() { PATH="$SYSTEM_PATH" command pm2 "$@"; }

read -r action sha extra <<<"${SSH_ORIGINAL_COMMAND:-}" || true
[ -z "${extra:-}" ] || { echo 'argumentos demais'; exit 64; }

exec 9>"$ROOT/deploy.lock"
flock -w 900 9 || { echo 'outra implantação em andamento'; exit 75; }

# server/ e deploy/ de um commit, uma vez só
unpack() {
  local commit="$1" target="$ROOT/releases/$1"
  [ -d "$target" ] && return 0
  rm -rf "$target.tmp" && mkdir -p "$target.tmp"
  git -C "$ROOT/repo.git" archive "$commit" server deploy | tar -x -C "$target.tmp"
  mv "$target.tmp" "$target"
}

case "${action:-}" in
  deploy)
    [[ "${sha:-}" =~ ^[0-9a-f]{40}$ ]] || { echo 'uso: deploy <sha de 40 caracteres>'; exit 64; }
    git -C "$ROOT/repo.git" fetch --quiet origin main
    # só o que está na main: nada de um commit qualquer da rede do GitHub
    git -C "$ROOT/repo.git" merge-base --is-ancestor "$sha" FETCH_HEAD ||
      { echo "$sha não está na main"; exit 65; }
    unpack "$sha"
    exec bash "$ROOT/releases/$sha/deploy/server/release.sh" "$sha"
    ;;
  rollback)
    current="$(tail -n 1 "$STATE/history" 2>/dev/null | cut -d' ' -f2)"
    previous="$(cut -d' ' -f2 "$STATE/history" 2>/dev/null | grep -vx "$current" | tail -n 1)"
    [ -n "$previous" ] || { echo 'não há versão anterior'; exit 66; }
    [ -d "$ROOT/releases/$previous" ] || unpack "$previous"
    echo "voltando de $current para $previous"
    exec bash "$ROOT/releases/$previous/deploy/server/release.sh" "$previous"
    ;;
  status)
    echo "ativa: $(cat "$STATE/active" 2>/dev/null || echo nenhuma)"
    for color in blue green; do
      [ -f "$STATE/$color.sha" ] && echo "$color: $(cat "$STATE/$color.sha")"
    done
    tail -n 5 "$STATE/history" 2>/dev/null || true
    # o `${...}` é do JavaScript, não do shell
    # shellcheck disable=SC2016
    pm2 jlist 2>/dev/null | node -e '
      let text = "";
      process.stdin.on("data", chunk => (text += chunk)).on("end", () => {
        for (const app of JSON.parse(text || "[]"))
          if (app.name.startsWith("ao-uerj"))
            console.log(app.name, app.pm2_env.status, `${Math.round(app.monit.memory / 1e6)} MB`);
      });'
    ;;
  *)
    echo 'uso: deploy <sha> | rollback | status'
    exit 64
    ;;
esac
