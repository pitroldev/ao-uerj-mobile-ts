import type { CheerioAPI } from './html';
import { loadHtml } from './html';

/**
 * A página do portal que vai no relato de problema, sem nada do aluno: fica
 * a estrutura (as tags, `id`, `class`, `colspan`, `rowspan`), e todo texto
 * vira a forma dele (letra por `x`, dígito por `9`), menos o que é do
 * portal e não do aluno:
 * - os códigos das disciplinas ("ABC01-12345"), os tempos ("M1", "P2") e os
 *   horários ("07:00");
 * - as palavras da interface (cabeçalhos, dias, situações de inscrição),
 *   desde que não sejam parte do nome do aluno;
 * - as frases do próprio portal ("Não constam disciplinas inscritas ou
 *   canceladas."), sem números, sem @ e sem o nome do aluno.
 *
 * Nome, matrícula, CPF, notas, professores, salas, nomes de disciplina e
 * resultados (aprovado, reprovado) saem só com a forma. Scripts, estilos,
 * imagens, comentários e eventos (`onclick`) saem inteiros; os outros
 * atributos ficam com o valor mascarado.
 */

/** Palavras da interface do portal, comparadas sem acento e sem caixa. */
const PORTAL_WORDS = new Set(
  `aluno online uerj matrícula disciplina disciplinas turma turmas local locais ava aula
  aulas tempo tempos segunda terça quarta quinta sexta sábado domingo feira
  horário horários dia dias semana início fim média final nota notas frequência
  faltas falta período créditos crédito carga horária hora horas tipo ramo
  ramificação ramif mínimo máximo atual realizada realizadas situação vagas
  vaga oferecidas solicitadas solicitada solicitado posição provisória
  provisório mensagem data orig obrigatória obrigatórias eletiva eletivas
  restrita restritas definida definidas universal universais cancelada
  canceladas cancelado trancada trancado trancamento inscrita inscritas
  inscrito inscrição inscrições cursando curso sim não sala bloco pavilhão
  laboratório lab campus maracanã docente docentes professor professora nome
  código versão currículo total exigido exigidos exigidas cursado cursados
  cursadas cr coeficiente rendimento resultado processamento último última
  conjunto ementa pré requisito requisitos co turno manhã tarde noite integral
  noturno diurno atividades complementares categoria consultar consulta acesso
  temporariamente bloqueado página encontrada sessão expirada constam há ainda
  registro visualização houve alteração classificado classificada excedente
  dependendo aguardando lista espera de da do das dos e ou o a os as no na nos
  nas em para por com sem que se ao à um uma
  discipinas crd ch freq cred chtotal atendida travacrédito noperíodo
  vagasoferecidas vagassolicitadas posiçãoprovisória obs rid sid atenção
  legenda resultados registrados síntese formação ingresso centro unidade
  regime titulação conclusão mês ano colação grau curriculares curricular
  cumprido cumprir habilitação ênfase observação períodos letivos`
    .split(/\s+/)
    .filter(Boolean)
    .map(fold),
);

/** Partículas que não identificam ninguém, mesmo no nome do aluno. */
const NAME_PARTICLES = new Set(['de', 'da', 'do', 'das', 'dos', 'e']);

const DROPPED_ELEMENTS =
  'script, style, link, meta, noscript, iframe, object, embed, svg, img, canvas';
const KEPT_ATTRIBUTES = new Set(['id', 'class', 'colspan', 'rowspan', 'type']);
/** Um valor maior que isso (imagem em base64, script) vira só a marca. */
const MAX_ATTRIBUTE = 200;

/** O tamanho padrão de uma página: cabem três no corpo de 100 KB do servidor. */
export const MAX_PAGE_CHARS = 24_000;

/**
 * As partes que o texto tem: um código de disciplina, um horário, um tempo
 * ("M1", "P2"), uma palavra ou um número. O resto (espaço, pontuação,
 * quebra de linha) fica como está.
 */
const TOKEN =
  /([A-Za-z]+\d+-\d+)|(\d{1,2}:\d{2})|(\b[A-Z]\d\b)|([\p{L}\p{M}]+)|(\p{N}+)/gu;

function fold(word: string) {
  return word.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

/** A forma do texto: letra por `x` (maiúscula por `X`), dígito por `9`. */
function shape(text: string) {
  return text.replace(/[\p{L}\p{M}\p{N}]/gu, char => {
    if (/\p{N}/u.test(char)) return '9';
    if (/\p{M}/u.test(char)) return '';
    return /\p{Lu}/u.test(char) ? 'X' : 'x';
  });
}

function personalParts(values: readonly string[]) {
  return new Set(
    values
      .flatMap(value => value.split(/[^\p{L}\p{M}\p{N}]+/u))
      .map(fold)
      .filter(part => part.length >= 2 && !NAME_PARTICLES.has(part)),
  );
}

/** Uma frase do portal: 4 palavras ou mais, com minúsculas e ponto no fim. */
function isPortalSentence(text: string, personal: ReadonlySet<string>) {
  const sentence = text.trim();
  if (sentence.length > 400 || !/[.!?:]$/.test(sentence)) return false;
  if (!/\p{Ll}/u.test(sentence) || /[\p{N}@]/u.test(sentence)) return false;
  const words = sentence.match(/[\p{L}\p{M}]+/gu) ?? [];
  return words.length >= 4 && !words.some(word => personal.has(fold(word)));
}

function maskText(text: string, personal: ReadonlySet<string>) {
  if (isPortalSentence(text, personal)) return text;
  return text.replace(
    TOKEN,
    (token, code?: string, time?: string, slot?: string, word?: string) => {
      if (code || time || slot) return token;
      if (word) {
        const folded = fold(word);
        return PORTAL_WORDS.has(folded) && !personal.has(folded)
          ? word
          : shape(word);
      }
      return shape(token);
    },
  );
}

function maskTree($: CheerioAPI, personal: ReadonlySet<string>) {
  $(DROPPED_ELEMENTS).remove();
  $('*')
    .contents()
    .each((_index, node) => {
      // 8 é comentário, 3 é texto (os `nodeType` do DOM)
      if (node.nodeType === 8) $(node).remove();
      else if (node.nodeType === 3 && 'data' in node)
        // a indentação entre as tags vira um espaço só (ou uma quebra), e a
        // página cabe inteira mais vezes
        node.data = /^\s+$/.test(node.data)
          ? node.data.includes('\n')
            ? '\n'
            : ' '
          : maskText(node.data, personal);
    });
  $('*').each((_index, element) => {
    if (!('attribs' in element)) return;
    const attributes: Record<string, string> = element.attribs;
    for (const [name, value] of Object.entries(attributes)) {
      if (KEPT_ATTRIBUTES.has(name)) continue;
      if (/^on/i.test(name) || name === 'style') delete attributes[name];
      else
        attributes[name] =
          value.length > MAX_ATTRIBUTE ? '[...]' : shape(value);
    }
  });
}

/**
 * O cheerio escreve os acentos como entidades ("N&#xe3;o"); de volta ao
 * texto, a página se lê no arquivo. Só acima de U+00A0: `<`, `&` e as aspas
 * continuam escapados.
 */
const readable = (html: string) =>
  html.replace(/&#x([0-9a-f]+);/gi, (entity, hex: string) => {
    const codePoint = Number.parseInt(hex, 16);
    return codePoint >= 0xa0 ? String.fromCodePoint(codePoint) : entity;
  });

/**
 * Corta as tabelas compridas (o histórico, as universais) até a página caber:
 * as primeiras linhas de cada uma ficam, com uma linha dizendo quantas saíram.
 */
function fit($: CheerioAPI, container: () => string, maxChars: number) {
  for (const keep of [80, 40, 20, 10, 5]) {
    if (container().length <= maxChars) return container();
    $('table').each((_index, table) => {
      const rows = $(table).find('tr');
      if (rows.length <= keep) return;
      rows.slice(keep).remove();
      $(table)
        .find('tr')
        .last()
        .after(
          `<tr><td colspan="99">[${rows.length - keep} linhas cortadas]</td></tr>`,
        );
    });
  }
  const html = container();
  return html.length <= maxChars
    ? html
    : `${html.slice(0, maxChars)}<!-- [página cortada] -->`;
}

/**
 * A página anonimizada. `personal` leva o nome e a matrícula da conta, que
 * nunca ficam, nem quando coincidem com uma palavra da interface.
 */
export function anonymizePortalPage(
  html: string,
  {
    personal,
    label,
    maxChars = MAX_PAGE_CHARS,
  }: { personal: readonly string[]; label: string; maxChars?: number },
): string {
  const $ = loadHtml(html);
  maskTree($, personalParts(personal));
  // o conteúdo da página (título e corpo); sem ele, a página inteira
  const box = $('.divContentBox').first();
  const container = () =>
    readable(box.length ? ($.html(box) ?? '') : ($('body').html() ?? ''));
  return `<!-- AO UERJ: página anonimizada (${label}) -->\n${fit($, container, maxChars)}`;
}
