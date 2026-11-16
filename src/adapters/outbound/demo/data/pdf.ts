/*
 * Um PDF de uma página, montado à mão, para os documentos da demonstração.
 * Diz com todas as letras que é fictício e não imita o documento da UERJ
 * (sem brasão, sem o leiaute e sem código de autenticação). Helvetica com
 * WinAnsiEncoding: os acentos vão como escapes octais, e o arquivo inteiro
 * fica em ASCII.
 */
import { ascii, toBase64 } from '@root/modules/trust/domain/bytes';

/** Texto de PDF: parênteses e barra escapados, acentos em octal (Latin-1). */
function pdfString(text: string): string {
  let out = '';
  for (const char of text) {
    const code = char.charCodeAt(0);
    if (char === '(' || char === ')' || char === '\\') out += `\\${char}`;
    else if (code >= 32 && code < 127) out += char;
    // no WinAnsi, os acentos do português têm o mesmo código do Latin-1
    else if (code >= 0xa0 && code <= 0xff)
      out += `\\${code.toString(8).padStart(3, '0')}`;
    else out += '?';
  }
  return `(${out})`;
}

type Line = { text: string; size: number; bold?: boolean; gap: number };

function contentStream(lines: readonly Line[]): string {
  const parts = [
    // moldura cinza: deixa claro que é uma folha de exemplo
    '0.6 G 2 w 48 48 499 746 re S',
    '0 g',
    'BT',
    '64 760 Td',
  ];
  lines.forEach((line, index) => {
    if (index > 0) parts.push(`0 -${line.gap} Td`);
    parts.push(
      `/${line.bold ? 'F2' : 'F1'} ${line.size} Tf`,
      `${pdfString(line.text)} Tj`,
    );
  });
  parts.push('ET');
  return parts.join('\n');
}

/** O PDF em texto (ASCII), com a tabela xref apontando cada objeto. */
function buildPdf(lines: readonly Line[]): string {
  const stream = contentStream(lines);
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] ' +
      '/Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
  ];
  let body = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((object, index) => {
    offsets.push(body.length);
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = body.length;
  // cada entrada tem exatamente 20 bytes, com o fim de linha " \n"
  const entries = [
    '0000000000 65535 f \n',
    ...offsets.map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`),
  ];
  return (
    `${body}xref\n0 ${objects.length + 1}\n${entries.join('')}` +
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n` +
    `startxref\n${xref}\n%%EOF\n`
  );
}

export type DemoPdfInput = {
  title: string;
  studentName: string;
  matricula: string;
  issuedOn: string;
};

/** O documento fictício, em base64 (sem `Buffer`, que o Hermes não tem). */
export function demoPdfBase64(input: DemoPdfInput): string {
  const pdf = buildPdf([
    { text: 'AO UERJ · Conta de demonstração', size: 12, gap: 0 },
    { text: input.title, size: 22, bold: true, gap: 48 },
    { text: 'Documento fictício, sem valor', size: 16, bold: true, gap: 40 },
    {
      text: 'Gerado no aparelho para mostrar como o app emite, guarda e',
      size: 11,
      gap: 32,
    },
    {
      text: 'compartilha documentos. Não foi emitido pela UERJ.',
      size: 11,
      gap: 16,
    },
    {
      text: `Aluno fictício: ${input.studentName} · Matrícula ${input.matricula}`,
      size: 11,
      gap: 32,
    },
    { text: `Gerado em ${input.issuedOn}`, size: 11, gap: 16 },
  ]);
  return toBase64(ascii(pdf));
}
