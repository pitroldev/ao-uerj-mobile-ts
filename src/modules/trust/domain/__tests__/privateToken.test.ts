import { rfcVector, testCrypto, testIssuer } from '../../__tests__/testCrypto';
import { ascii, concat, fromBase64, toHex } from '../bytes';
import {
  authorization,
  blindToken,
  encodeChallenge,
  finalizeToken,
  issuanceRequestHash,
  parseTokenKey,
  tokenKeyId,
  TOKEN_BYTES,
} from '../privateToken';

describe('the RFC 9578 vector (Blind RSA, type 0x0002)', () => {
  const key = parseTokenKey(testCrypto, rfcVector.pkI)!;
  const blindWithVector = () =>
    blindToken(testCrypto, key, rfcVector.tokenChallenge, {
      nonce: rfcVector.nonce,
      salt: rfcVector.salt,
      blind: rfcVector.blind,
    });

  it('reads the issuer key in the RFC form', () => {
    expect(key).not.toBeNull();
    expect(key.e).toBe(65537n);
    expect(key.id).toEqual(testCrypto.sha256(rfcVector.pkI));
  });

  it('blinds the token request byte for byte', () => {
    expect(toHex(blindWithVector().request)).toBe(
      toHex(rfcVector.tokenRequest),
    );
  });

  it('finalizes the issuer response into the exact token', () => {
    const token = finalizeToken(
      testCrypto,
      key,
      blindWithVector(),
      rfcVector.tokenResponse,
    );
    expect(token && toHex(token)).toBe(toHex(rfcVector.token));
    expect(token?.length).toBe(TOKEN_BYTES);
    expect(tokenKeyId(token!)).toBe(toHex(key.id));
  });

  it('refuses a response that does not verify', () => {
    const forged = rfcVector.tokenResponse.slice();
    forged[forged.length - 1] = (forged[forged.length - 1] + 1) % 256;
    expect(
      finalizeToken(testCrypto, key, blindWithVector(), forged),
    ).toBeNull();
    expect(
      finalizeToken(testCrypto, key, blindWithVector(), forged.subarray(1)),
    ).toBeNull();
    // um valor maior que o módulo
    expect(
      finalizeToken(
        testCrypto,
        key,
        blindWithVector(),
        new Uint8Array(256).fill(255),
      ),
    ).toBeNull();
  });
});

describe('the token key', () => {
  it('accepts only RSA 2048 with e = 65537 in the RFC SPKI', () => {
    const { pkI } = rfcVector;
    expect(parseTokenKey(testCrypto, pkI.subarray(1))).toBeNull();
    const otherHash = pkI.slice();
    otherHash[20] = (otherHash[20] + 1) % 256;
    expect(parseTokenKey(testCrypto, otherHash)).toBeNull();
    const otherExponent = pkI.slice();
    otherExponent[otherExponent.length - 1] = 3;
    expect(parseTokenKey(testCrypto, otherExponent)).toBeNull();
    // um módulo menor que 2048 bits
    const shortModulus = pkI.slice();
    shortModulus[72 + 9] = 0x7f;
    expect(parseTokenKey(testCrypto, shortModulus)).toBeNull();
  });
});

describe('issuance and redemption encodings', () => {
  it('builds the fixed challenge: pitrol.dev for issuer and origin, no context', () => {
    const challenge = encodeChallenge();
    expect(toHex(challenge)).toBe(
      `0002000a${toHex(ascii('pitrol.dev'))}00000a${toHex(ascii('pitrol.dev'))}`,
    );
    // a mesma codificação do vetor da RFC (com contexto, que o app não usa)
    expect(toHex(rfcVector.tokenChallenge.subarray(0, 18))).toBe(
      toHex(
        encodeChallenge('issuer.example', 'origin.example').subarray(0, 18),
      ),
    );
  });

  it('hashes the label, the challenge, the installation and the requests, in hex', () => {
    const challenge = new Uint8Array(36).fill(1);
    const installation = new Uint8Array(32).fill(2);
    const requests = [new Uint8Array(259).fill(3), new Uint8Array(259).fill(4)];
    expect(
      issuanceRequestHash(testCrypto, {
        challenge,
        installation,
        tokenRequests: requests,
      }),
    ).toBe(
      toHex(
        testCrypto.sha256(
          concat(
            ascii('AO UERJ token issuance v1'),
            challenge,
            installation,
            ...requests,
          ),
        ),
      ),
    );
  });

  it('a fresh key and random blinding give a token that verifies, sent as RFC 9577 asks', () => {
    const issuer = testIssuer();
    const key = parseTokenKey(testCrypto, issuer.tokenKey)!;
    const blinded = blindToken(testCrypto, key, encodeChallenge());
    expect(blinded.request.length).toBe(259);
    const token = finalizeToken(
      testCrypto,
      key,
      blinded,
      issuer.sign(blinded.request),
    );
    expect(token).not.toBeNull();
    const header = authorization(token!);
    const [, encoded] = /^PrivateToken token="([A-Za-z0-9_-]+=*)"$/.exec(
      header,
    )!;
    expect(fromBase64(encoded)).toEqual(token);
    expect(tokenKeyId(new Uint8Array(10))).toBeNull();
  });
});
