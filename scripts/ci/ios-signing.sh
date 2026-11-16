#!/usr/bin/env bash
# Importa somente credenciais do environment app-store em um runner descartável.
set -euo pipefail
umask 077

: "${RUNNER_TEMP:?}"
: "${GITHUB_ENV:?}"
: "${APPLE_TEAM_ID:?}"
: "${IOS_DISTRIBUTION_P12:?}"
: "${IOS_DISTRIBUTION_PASSWORD:?}"
: "${IOS_APP_PROFILE:?}"
: "${IOS_WIDGET_PROFILE:?}"

printf '%s' "$IOS_DISTRIBUTION_P12" | base64 --decode > "$RUNNER_TEMP/distribution.p12"
printf '%s' "$IOS_APP_PROFILE" | base64 --decode > "$RUNNER_TEMP/app.mobileprovision"
printf '%s' "$IOS_WIDGET_PROFILE" | base64 --decode > "$RUNNER_TEMP/widget.mobileprovision"

keychain="$RUNNER_TEMP/ao-uerj-signing.keychain-db"
keychain_password=$(openssl rand -hex 32)
echo "::add-mask::$keychain_password"
security create-keychain -p "$keychain_password" "$keychain"
security set-keychain-settings -lut 21600 "$keychain"
security unlock-keychain -p "$keychain_password" "$keychain"
security import "$RUNNER_TEMP/distribution.p12" -P "$IOS_DISTRIBUTION_PASSWORD" \
  -A -t cert -f pkcs12 -k "$keychain"
security set-key-partition-list -S apple-tool:,apple:,codesign: -s \
  -k "$keychain_password" "$keychain" >/dev/null
security list-keychains -d user -s "$keychain" "$HOME/Library/Keychains/login.keychain-db"
security find-identity -v -p codesigning "$keychain"

for kind in app widget; do
  security cms -D -i "$RUNNER_TEMP/$kind.mobileprovision" > "$RUNNER_TEMP/$kind-profile.plist"
done

python3 - <<'PY'
import datetime
import os
import pathlib
import plistlib
import shutil

temp = pathlib.Path(os.environ['RUNNER_TEMP'])
team = os.environ['APPLE_TEAM_ID']
profiles = pathlib.Path.home() / 'Library/MobileDevice/Provisioning Profiles'
profiles.mkdir(parents=True, exist_ok=True)
export_profiles = {}
for kind, bundle in [('app', 'com.aouerjmobile'), ('widget', 'com.aouerjmobile.NextClassWidget')]:
    with (temp / f'{kind}-profile.plist').open('rb') as stream:
        profile = plistlib.load(stream)
    entitlements = profile['Entitlements']
    assert profile['TeamIdentifier'] == [team], 'Perfil de outra equipe'
    assert entitlements['application-identifier'] == f'{team}.{bundle}', 'Bundle ID incorreto'
    assert not entitlements.get('get-task-allow'), 'Perfil de desenvolvimento'
    assert not profile.get('ProvisionedDevices'), 'Perfil ad hoc'
    assert not profile.get('ProvisionsAllDevices'), 'Perfil enterprise'
    assert profile['ExpirationDate'] > datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None), 'Perfil expirado'
    assert 'group.com.aouerjmobile' in entitlements['com.apple.security.application-groups'], 'Falta App Group'
    if kind == 'app':
        environments = entitlements['com.apple.developer.devicecheck.appattest-environment']
        if isinstance(environments, str):
            environments = [environments]
        assert 'production' in environments, 'Perfil não permite App Attest de produção'
    uuid = profile['UUID']
    shutil.copyfile(temp / f'{kind}.mobileprovision', profiles / f'{uuid}.mobileprovision')
    export_profiles[bundle] = uuid
    with open(os.environ['GITHUB_ENV'], 'a') as stream:
        stream.write(f'IOS_{kind.upper()}_PROFILE_UUID={uuid}\n')
with (temp / 'ExportOptions.plist').open('wb') as stream:
    plistlib.dump({
        'method': 'app-store-connect',
        'destination': 'export',
        'teamID': team,
        'signingStyle': 'manual',
        'signingCertificate': 'Apple Distribution',
        'provisioningProfiles': export_profiles,
        'manageAppVersionAndBuildNumber': False,
        'uploadSymbols': True,
    }, stream)
PY
