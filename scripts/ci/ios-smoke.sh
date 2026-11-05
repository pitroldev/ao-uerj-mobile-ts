#!/usr/bin/env bash
# Abre o build de release num simulador de iPhone e confere que o app não
# cai: na abertura (o login), no tema escuro, no atalho do ícone, no link
# aouerj:// e numa rodada da verificação em segundo plano. Sem conta: o que
# depende do login fica nos testes do Jest, que rodam como iOS.
# Uso: ios-smoke.sh <AOUerjMobile.app> <pasta de saída>
set -euo pipefail

app="$1"
out="$2"
bundle_id="com.aouerjmobile"
mkdir -p "$out"

# o iPhone mais novo que o Xcode do runner tem
udid=$(xcrun simctl list devices available --json | jq -r '
  [.devices | to_entries[] | select(.key | test("iOS")) | .value[]
    | select(.name | test("^iPhone"))] | last | .udid')
if [ -z "$udid" ] || [ "$udid" = "null" ]; then
  echo "::error::nenhum simulador de iPhone disponível"
  exit 1
fi
xcrun simctl list devices | grep "$udid" || true

xcrun simctl boot "$udid"
xcrun simctl bootstatus "$udid" -b
xcrun simctl install "$udid" "$app"

failed=0
pid=""

alive() {
  # os apps do simulador são processos do próprio Mac
  [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null
}

check() {
  local moment="$1"
  if alive; then
    echo "ok: o app segue aberto ($moment)"
  else
    echo "::error::o app fechou ($moment)"
    failed=1
  fi
}

launch() {
  pid=$(xcrun simctl launch "$@" "$udid" "$bundle_id" | awk '{print $NF}')
  echo "pid $pid"
}

launch
# a primeira abertura do release monta o Hermes e lê o cofre
sleep 45
check "abertura"
xcrun simctl io "$udid" screenshot "$out/1-abertura.png"

xcrun simctl ui "$udid" appearance dark
sleep 8
check "tema escuro"
xcrun simctl io "$udid" screenshot "$out/2-escuro.png"
xcrun simctl ui "$udid" appearance light

# o link do widget e dos atalhos, com o app aberto
xcrun simctl openurl "$udid" "aouerj://open?target=home"
sleep 8
check "link aouerj://"
xcrun simctl io "$udid" screenshot "$out/3-link.png"

# de novo do zero: a segunda abertura lê o que a primeira gravou
xcrun simctl terminate "$udid" "$bundle_id" || true
sleep 3
launch
sleep 30
check "segunda abertura"
xcrun simctl io "$udid" screenshot "$out/4-segunda-abertura.png"

# Uma rodada da verificação em segundo plano. O simulador não roda o
# BGTaskScheduler: com a variável (só o simctl a passa ao app), o AppDelegate
# segue o caminho da rodada antes de a cena se conectar. O React Native abre
# sem janela, o JS recebe a rodada e a encerra (sem conta, logo), e a cena
# que se conecta em seguida usa o mesmo React Native. As linhas saem no log
# do sistema e na saída de erro.
xcrun simctl terminate "$udid" "$bundle_id" || true
sleep 3
export SIMCTL_CHILD_AO_SMOKE_BACKGROUND_CHECK=1
launch --stderr="$out/segundo-plano.log"
unset SIMCTL_CHILD_AO_SMOKE_BACKGROUND_CHECK
sleep 30
check "rodada em segundo plano"
xcrun simctl io "$udid" screenshot "$out/5-segundo-plano.png"

xcrun simctl spawn "$udid" log show --last 10m --style compact \
  --predicate "subsystem CONTAINS \"$bundle_id\" OR process CONTAINS \"aouerj\" OR process CONTAINS \"AOUerj\"" \
  > "$out/app.log" 2>&1 || true

# a linha vale da saída de erro ou do log do sistema (com -q, um arquivo que
# falte não apaga o que o outro achou)
background_line() {
  grep -q -s -F "$1" "$out/segundo-plano.log" "$out/app.log"
}
if background_line "rodada smoke encerrada: JS (success=1)"; then
  echo "ok: o JS recebeu e encerrou a rodada em segundo plano"
else
  echo "::error::o JS não encerrou a rodada em segundo plano (ver segundo-plano.log)"
  failed=1
fi
if background_line "cena conectada: usa o React Native já aberto"; then
  echo "ok: a cena usou o React Native aberto sem janela"
else
  echo "::error::a cena não usou o React Native aberto sem janela"
  failed=1
fi
# os relatórios de queda do simulador ficam no Mac
find "$HOME/Library/Logs/DiagnosticReports" -iname "*aouerj*" \
  -exec cp {} "$out/" \; 2>/dev/null || true
if ls "$out" | grep -qi -E "\.(ips|crash)$"; then
  echo "::error::há relatório de queda do app"
  failed=1
fi

exit "$failed"
