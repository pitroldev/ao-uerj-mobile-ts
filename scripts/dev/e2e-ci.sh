#!/usr/bin/env bash
# Roda os fluxos E2E do Maestro (.maestro/) no emulador já ligado, com o Metro
# rodando na máquina: o modo demonstração só existe no build de debug.
# Usado pelo .github/workflows/e2e.yml; serve também em Linux e macOS.
#
# Uso: scripts/dev/e2e-ci.sh <apk de debug> <pasta de saída>
set -euo pipefail

apk="$1"
out="$2"
app=com.aouerjmobile
mkdir -p "$out"

adb wait-for-device
adb install -r "$apk"

# O app busca o JS em localhost:8081 pelo adb reverse, e não no 10.0.2.2 do
# emulador, que pode travar no meio de um bundle grande. Sem Fast Refresh, uma
# mudança no código não recarrega o app no meio de um fluxo.
adb reverse tcp:8081 tcp:8081
prefs="$(mktemp)"
cat >"$prefs" <<'XML'
<?xml version='1.0' encoding='utf-8' standalone='yes' ?>
<map>
    <string name="debug_http_host">localhost:8081</string>
    <boolean name="hot_module_replacement" value="false" />
</map>
XML
adb push "$prefs" /data/local/tmp/aouerj-dev-prefs.xml
adb shell "run-as $app sh -c 'mkdir -p shared_prefs && cp /data/local/tmp/aouerj-dev-prefs.xml shared_prefs/${app}_preferences.xml'"

# Emuladores de CI às vezes mostram "Pixel Launcher isn't responding" por cima
# do app; os diálogos de erro e de ANR do sistema não fazem parte do teste.
adb shell settings put global hide_error_dialogs 1
adb shell settings put global anr_show_background 0
adb shell am broadcast -a android.intent.action.CLOSE_SYSTEM_DIALOGS > /dev/null || true

api_level="$(adb shell getprop ro.build.version.sdk | tr -d '\r')"

# maestro test <fluxos> <pasta>
run_maestro() {
  mkdir -p "$out/$2"
  maestro test "$1" \
    --format JUNIT --output "$out/$2/report.xml" \
    --test-output-dir "$out/$2" --debug-output "$out/$2/debug" \
    -e API_LEVEL="$api_level"
}

status=0
run_maestro .maestro fluxos || status=1

# Recriação pela fonte do sistema: mudar o font_scale com o app aberto recria
# a activity (ver .maestro/08-recriacao-activity.yaml).
run_maestro .maestro/recriacao/1-abrir-conversa.yaml recriacao-1 || status=1
adb shell settings put system font_scale 1.3
sleep 5
run_maestro .maestro/recriacao/2-conferir.yaml recriacao-2 || status=1
adb shell settings put system font_scale 1.0

adb logcat -d >"$out/logcat.txt" || true
exit "$status"
