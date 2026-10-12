/** Saúde das vagas, convertida em tom por `healthTone` (`@components/ui`). */
export type VacancyHealth = 'GOOD' | 'BAD' | 'CRITICAL';

export function getVacancieHealth(
  taken: number,
  available: number,
  inverse = false,
): {
  status: VacancyHealth;
  percentage: number;
} {
  try {
    const percentage = !inverse ? 1 - taken / available : taken / available;

    if (percentage < 0.5) {
      return { status: 'CRITICAL', percentage };
    }

    if (percentage < 0.8) {
      return { status: 'BAD', percentage };
    }
    return { status: 'GOOD', percentage };
  } catch {
    return { status: 'GOOD', percentage: -1 };
  }
}
