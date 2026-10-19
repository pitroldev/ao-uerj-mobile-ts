import type {
  GraduationSynthesis,
  SynthesisRequirement,
  SynthesisRequirementKind,
} from '@root/modules/academics/domain/models';
import type { CheerioAPI } from '../html';
import { optionalNumber, requireStructure } from './contract';

/**
 * "Síntese da Formação", como observada em 18/10/2026: três caixas
 * (.divContentBox) com o cabeçalho em .divContentBoxHeader. Os dados são
 * divs com o rótulo em negrito ("<b>Regime:</b> Crédito"); os requisitos e os
 * períodos ficam em tabelas com cabeçalho em <th>.
 */

/** O texto depois de um rótulo em negrito; `null` sem o rótulo ou sem valor. */
function labeled($: CheerioAPI, label: RegExp): string | null {
  const bold = $('b')
    .filter((_index, node) => label.test($(node).text()))
    .first();
  if (!bold.length) return null;
  const text = bold.parent().text().replace(bold.text(), '').trim();
  return text || null;
}

function count($: CheerioAPI, label: RegExp): number | null {
  const text = labeled($, label);
  return text === null ? null : optionalNumber(text);
}

/** A tabela cujo cabeçalho tem um <th> com este texto. */
function tableWith($: CheerioAPI, header: RegExp) {
  return $('th')
    .filter((_index, node) => header.test($(node).text().trim()))
    .first()
    .closest('table');
}

const KINDS: [RegExp, SynthesisRequirementKind][] = [
  [/grupo de obrigat/i, 'MANDATORY'],
  [/restritas/i, 'RESTRICTED'],
  [/eletivas definidas/i, 'DEFINED'],
  [/eletivas universais/i, 'UNIVERSAL'],
  [/total de eletivas/i, 'ELECTIVES'],
];

/**
 * "Detalhamento dos Requisitos do Currículo": as linhas sem números são
 * títulos ("Ramificação 105 - …", "Eletivas Extra Ramificação"); a
 * ramificação vale para os grupos de obrigatórias logo abaixo dela.
 */
function requirements($: CheerioAPI): SynthesisRequirement[] {
  const items: SynthesisRequirement[] = [];
  let branch: string | null = null;
  tableWith($, /^requisitos do currículo$/i)
    .find('tbody tr')
    .each((_index, row) => {
      const cells = $(row).children('td');
      const label = cells
        .eq(0)
        .text()
        .replace(/^[\s•]+/, '')
        .trim();
      if (!label) return;
      const done = optionalNumber(cells.eq(1).text());
      const required = optionalNumber(cells.eq(2).text());
      if (done === null && required === null) {
        branch = /^ramifica/i.test(label)
          ? label.replace(/^ramificação\s*/i, '')
          : null;
        return;
      }
      const kind = KINDS.find(([pattern]) => pattern.test(label))?.[1];
      items.push({
        kind: kind ?? 'OTHER',
        label,
        branch: kind === 'MANDATORY' ? branch : null,
        done,
        required,
      });
    });
  return items;
}

/** O período "Inscrito" da tabela de períodos letivos ("2026/1" → "2026.1"). */
function currentPeriod($: CheerioAPI): string | null {
  const cells = tableWith($, /^per[ií]odo$/i)
    .find('td')
    .map((_index, node) => $(node).text().trim())
    .get();
  const index = cells.findIndex(
    (text, i) => /^\d{4}\/\d$/.test(text) && /inscrito/i.test(cells[i + 1]),
  );
  return index < 0 ? null : cells[index].replace('/', '.');
}

export function parseGraduationSynthesis($: CheerioAPI): GraduationSynthesis {
  const titles = $('.divContentBoxHeader')
    .map((_index, node) => $(node).text().trim())
    .get();
  requireStructure(titles.some(title => /síntese da formação/i.test(title)));
  requireStructure(titles.some(title => /períodos letivos/i.test(title)));
  return {
    curriculumVersion: labeled($, /versão curricular/i),
    regime: labeled($, /^\s*regime/i),
    cr: count($, /coeficiente de rendimento/i),
    requirements: requirements($),
    periods: {
      minimum: count($, /mínimo de períodos/i),
      used: count($, /períodos utilizados/i),
      maximum: count($, /máximo de períodos/i),
      remaining: count($, /períodos restantes/i),
      extra: count($, /períodos extras/i),
    },
    currentPeriod: currentPeriod($),
  };
}
