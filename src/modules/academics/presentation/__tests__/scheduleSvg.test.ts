import { toSvgDataUri } from '../scheduleSvg';

declare const TextDecoder: new () => { decode(bytes: Uint8Array): string };
declare function atob(data: string): string;

const PREFIX = 'data:image/svg+xml;base64,';

function decodeDataUri(uri: string) {
  expect(uri.startsWith(PREFIX)).toBe(true);
  const binary = atob(uri.slice(PREFIX.length));
  return new TextDecoder().decode(
    Uint8Array.from(binary, char => char.charCodeAt(0)),
  );
}

it('encodes the SVG as UTF-8 base64', () => {
  expect(toSvgDataUri('<text>Terça – €</text>')).toBe(
    `${PREFIX}PHRleHQ+VGVyw6dhIOKAkyDigqw8L3RleHQ+`,
  );
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg"><text>Álgebra &amp; Cálculo</text></svg>';
  expect(decodeDataUri(toSvgDataUri(svg))).toBe(svg);
});

it('joins chunks of large SVGs without padding in the middle', () => {
  // 2-byte characters make chunk boundaries fall inside a character.
  const svg = `<svg>${'ç'.repeat(9000)}€</svg>`;
  const uri = toSvgDataUri(svg);
  expect(uri.slice(PREFIX.length, -2)).not.toContain('=');
  expect(decodeDataUri(uri)).toBe(svg);
});
