#!/usr/bin/env bash
# As atestações de mentira do App Attest para os testes (appAttest.test.ts):
# uma raiz e uma intermediária falsas no lugar das da Apple e, por caso, um
# credCert (P-256) com o nonce na extensão 1.2.840.113635.100.8.2, montado
# como a Apple monta. Roda uma vez, com o OpenSSL 1.1.1 ou 3, e o resultado
# fica no Git; as chaves privadas ficam numa pasta temporária e somem no fim
# (nenhuma chave vai para o repositório).
#
#   bash server/test/fixtures/appAttest.sh
#
# Escreve appAttest.json, ao lado: o App ID, o clientDataHash (fixo), as duas
# raízes, as duas intermediárias e, por caso, o keyId, o authData e o
# credCert, tudo em base64 padrão (os certificados em DER). O teste monta o
# objeto de atestação (CBOR) com eles.
set -euo pipefail

# o Git Bash do Windows trocaria "/CN=…" por um caminho do disco
export MSYS_NO_PATHCONV=1

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
out="$here/appAttest.json"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
cd "$work"

APP_ID='ABCDE12345.com.aouerjmobile'
# as autoridades valem 20 anos; o credCert, 10 (vence antes delas)
CA_DAYS=7300
LEAF_DAYS=3650
# "appattest" e sete zeros (produção); "appattestdevelop" (desenvolvimento)
AAGUID_PRODUCTION=61707061747465737400000000000000
AAGUID_DEVELOPMENT=617070617474657374646576656c6f70
# quase o de produção: o último byte muda
AAGUID_OTHER=61707061747465737400000000000001

b64() { openssl base64 -A; }
hex() { od -An -tx1 -v | tr -d ' \n'; }
sha256() { openssl dgst -sha256 -binary; }
der() { openssl x509 -in "$1" -outform DER; }
serial() { echo "0x$(openssl rand -hex 16)"; }

# os bytes de um texto em hex ("0020" → 0x00 0x20)
unhex() {
  local digits=$1 escaped=''
  while [[ -n $digits ]]; do
    escaped+="\\x${digits:0:2}"
    digits=${digits:2}
  done
  printf '%b' "$escaped"
}

key() {
  openssl genpkey -algorithm EC -pkeyopt "ec_paramgen_curve:$2" \
    -pkeyopt ec_param_enc:named_curve -out "$1"
}

cat > openssl.cnf <<'EOF'
[ req ]
distinguished_name = dn
prompt = no

[ dn ]
CN = unused

[ root ]
basicConstraints = critical, CA:TRUE
keyUsage = critical, keyCertSign, cRLSign
subjectKeyIdentifier = hash

[ intermediate ]
basicConstraints = critical, CA:TRUE, pathlen:0
keyUsage = critical, keyCertSign, cRLSign
subjectKeyIdentifier = hash
authorityKeyIdentifier = keyid:always
EOF

# root <nome> <subject>: uma raiz (P-384, como a da Apple)
root() {
  key "$1.key" P-384
  openssl req -x509 -new -config openssl.cnf -extensions root -key "$1.key" \
    -sha384 -days "$CA_DAYS" -set_serial "$(serial)" -subj "$2" -out "$1.pem"
}

# intermediate <nome> <subject> <raiz>
intermediate() {
  key "$1.key" P-384
  openssl req -new -config openssl.cnf -key "$1.key" -subj "$2" -out "$1.csr"
  openssl x509 -req -in "$1.csr" -CA "$3.pem" -CAkey "$3.key" \
    -set_serial "$(serial)" -days "$CA_DAYS" -sha384 \
    -extfile openssl.cnf -extensions intermediate -out "$1.pem"
}

printf 'AO UERJ App Attest fixture' | sha256 > client-data-hash.bin

# credcert <caso> <intermediária> <aaguid> <contador> <credentialId> <nonce>
#   aaguid e contador em hex; credentialId: "key" (o keyId, como a Apple
#   faz) ou "other"; nonce: "yes" ou "no" (sem a extensão).
credcert() {
  # os arquivos do caso têm prefixo: não pisam nos das autoridades
  local name="leaf-$1" issuer=$2 aaguid=$3 counter=$4 credential=$5 nonce=$6
  key "$name.key" P-256
  # o ponto da chave pública (0x04 ‖ X ‖ Y): os 65 bytes do fim do SPKI
  openssl pkey -in "$name.key" -pubout -outform DER | tail -c 65 > "$name.point"
  sha256 < "$name.point" > "$name.keyid"
  if [[ $credential == key ]]; then
    cp "$name.keyid" "$name.credid"
  else
    printf 'outra chave' | sha256 > "$name.credid"
  fi
  {
    printf '%s' "$APP_ID" | sha256 # rpIdHash
    unhex 40 # flags: AT, com a credencial atestada
    unhex "$counter"
    unhex "$aaguid"
    unhex 0020 # o tamanho do credentialId
    cat "$name.credid"
    # a chave em COSE: {1: 2 (EC2), 3: -7 (ES256), -1: 1 (P-256), -2: x, -3: y}
    unhex a5010203262001215820
    tail -c 64 "$name.point" | head -c 32
    unhex 225820
    tail -c 32 "$name.point"
  } > "$name.authdata"
  {
    echo '[ credcert ]'
    echo 'basicConstraints = critical, CA:FALSE'
    echo 'keyUsage = critical, digitalSignature'
    if [[ $nonce == yes ]]; then
      # SEQUENCE { [1] EXPLICIT OCTET STRING (SHA-256(authData ‖ clientDataHash)) }
      echo '1.2.840.113635.100.8.2 = ASN1:SEQUENCE:nonce'
      echo '[ nonce ]'
      echo "value = EXPLICIT:1,FORMAT:HEX,OCTETSTRING:$(cat "$name.authdata" client-data-hash.bin | sha256 | hex)"
    fi
  } > "$name.cnf"
  openssl req -new -config openssl.cnf -key "$name.key" \
    -subj "/CN=$(hex < "$name.keyid")/O=AO UERJ tests" -out "$name.csr"
  openssl x509 -req -in "$name.csr" -CA "$issuer.pem" -CAkey "$issuer.key" \
    -set_serial "$(serial)" -days "$LEAF_DAYS" -sha256 \
    -extfile "$name.cnf" -extensions credcert -out "$name.pem"
}

root root '/CN=Fake App Attestation Root CA/O=AO UERJ tests'
intermediate intermediate '/CN=Fake App Attestation CA 1/O=AO UERJ tests' root
# outra raiz, e uma intermediária dela com o mesmo nome da nossa
root other-root '/CN=Other App Attestation Root CA/O=AO UERJ tests'
intermediate impostor '/CN=Fake App Attestation CA 1/O=AO UERJ tests' other-root

CASES=(valid development otherAaguid counter credentialId withoutNonce impostor)
credcert valid intermediate "$AAGUID_PRODUCTION" 00000000 key yes
credcert development intermediate "$AAGUID_DEVELOPMENT" 00000000 key yes
credcert otherAaguid intermediate "$AAGUID_OTHER" 00000000 key yes
credcert counter intermediate "$AAGUID_PRODUCTION" 00000001 key yes
credcert credentialId intermediate "$AAGUID_PRODUCTION" 00000000 other yes
credcert withoutNonce intermediate "$AAGUID_PRODUCTION" 00000000 key no
credcert impostor impostor "$AAGUID_PRODUCTION" 00000000 key yes

{
  echo '{'
  echo '  "generatedBy": "server/test/fixtures/appAttest.sh",'
  printf '  "appId": "%s",\n' "$APP_ID"
  printf '  "clientDataHash": "%s",\n' "$(b64 < client-data-hash.bin)"
  printf '  "root": "%s",\n' "$(der root.pem | b64)"
  printf '  "intermediate": "%s",\n' "$(der intermediate.pem | b64)"
  printf '  "otherRoot": "%s",\n' "$(der other-root.pem | b64)"
  printf '  "impostor": "%s",\n' "$(der impostor.pem | b64)"
  echo '  "credCerts": {'
  last=$((${#CASES[@]} - 1))
  for index in "${!CASES[@]}"; do
    name=${CASES[$index]}
    comma=','
    [[ $index == "$last" ]] && comma=''
    printf '    "%s": {\n' "$name"
    printf '      "keyId": "%s",\n' "$(b64 < "leaf-$name.keyid")"
    printf '      "authData": "%s",\n' "$(b64 < "leaf-$name.authdata")"
    printf '      "certificate": "%s"\n' "$(der "leaf-$name.pem" | b64)"
    printf '    }%s\n' "$comma"
  done
  echo '  }'
  echo '}'
} > "$out"

echo "wrote $out"
