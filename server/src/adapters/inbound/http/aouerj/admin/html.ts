/**
 * HTML com escape por padrão: todo valor interpolado vira texto, menos o que
 * já é `Html` (outro trecho montado aqui). O que vem dos relatos (descrição,
 * página, e-mail) nunca vira marcação.
 */
export class Html {
  readonly value: string;
  constructor(value: string) {
    this.value = value;
  }
}

const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, char => ESCAPES[char]);

type Part = Html | string | number | false | null | undefined | Part[];

function render(part: Part): string {
  if (part instanceof Html) return part.value;
  if (Array.isArray(part)) return part.map(render).join('');
  if (part === null || part === undefined || part === false) return '';
  return escapeHtml(String(part));
}

export function html(strings: TemplateStringsArray, ...parts: Part[]): Html {
  let out = strings[0];
  parts.forEach((part, index) => {
    out += render(part) + strings[index + 1];
  });
  return new Html(out);
}

/** Um trecho confiável (CSS, SVG gerado aqui), sem escape. */
export const trusted = (value: string) => new Html(value);
