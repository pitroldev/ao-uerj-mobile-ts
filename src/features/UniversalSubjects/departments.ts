import { UERJ_UNIT_OPTIONS } from '@root/utils/constants/unitOptions';
import type { UniversalSubject } from '@root/modules/academics/domain/models';

export type DepartmentOption = { value: string; label: string };

/** Preposições e conjunções que ficam em minúscula fora da primeira palavra. */
const LOWERCASE_WORDS = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'com']);

/**
 * Só para exibição: "Instituto De Letras" → "Instituto de Letras". A lista
 * de unidades vem com toda palavra capitalizada; aqui as preposições voltam
 * à minúscula, exceto na primeira palavra.
 */
export function formatUnitName(name: string): string {
  return name
    .split(' ')
    .map((word, index) =>
      index > 0 && LOWERCASE_WORDS.has(word.toLowerCase())
        ? word.toLowerCase()
        : word,
    )
    .join(' ');
}

/**
 * Unidade de uma disciplina a partir do código ("ILE01-10301" → "ILE"):
 * `value` é a sigla só com letras (usada no filtro) e `label` o nome da
 * unidade da UERJ ("ILE - Instituto de Letras") ou o prefixo do código
 * quando a unidade não é conhecida.
 */
export function departmentOf(subjectId: string): DepartmentOption & {
  /** Nome da unidade sem a sigla ("Instituto de Letras"), se conhecida. */
  unitName?: string;
} {
  const [departmentCode = ''] = subjectId.split('-');
  const value = departmentCode.replace(/\d/g, '');
  const unit = UERJ_UNIT_OPTIONS.find(({ text }) => text.includes(value))?.text;
  if (!unit) return { value, label: departmentCode, unitName: undefined };
  const [acronym, ...nameParts] = unit.split(' - ');
  const unitName = formatUnitName(nameParts.join(' - ')) || undefined;
  return {
    value,
    label: unitName ? `${acronym} - ${unitName}` : unit,
    unitName,
  };
}

/** Departamentos presentes na lista, sem repetição, em ordem alfabética. */
export function buildDepartmentOptions(
  subjects: readonly UniversalSubject[],
): DepartmentOption[] {
  return subjects
    .reduce((acc, subject) => {
      const { value, label } = departmentOf(subject.id);
      const alreadyHasDepartment = acc.some(option =>
        option.value.includes(value),
      );
      return alreadyHasDepartment ? acc : [...acc, { value, label }];
    }, [] as DepartmentOption[])
    .sort((a, b) => a.label.localeCompare(b.label));
}
