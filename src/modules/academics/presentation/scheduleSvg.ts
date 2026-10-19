/**
 * O SVG da semana vira data URI para o compartilhamento cair no SVG quando a
 * captura em PNG falha. O desenho da imagem fica na agenda
 * (`features/AttendedClassesSchedule/weekImage`).
 */

// O Hermes (RN 0.74+) tem estes globais, mas os tipos do React Native não os
// declaram.
declare const TextEncoder: new () => { encode(input: string): Uint8Array };
declare function btoa(data: string): string;

// Múltiplo de 3: o base64 de cada bloco emenda no seguinte sem padding.
const BASE64_CHUNK_SIZE = 3 * 4096;

/** Data URI do SVG, compartilhado quando a captura em PNG falha. */
export const toSvgDataUri = (svg: string) => {
  const bytes = new TextEncoder().encode(svg);
  let base64 = '';
  for (let start = 0; start < bytes.length; start += BASE64_CHUNK_SIZE) {
    const chunk = bytes.subarray(start, start + BASE64_CHUNK_SIZE);
    base64 += btoa(String.fromCharCode(...chunk));
  }
  return `data:image/svg+xml;base64,${base64}`;
};
