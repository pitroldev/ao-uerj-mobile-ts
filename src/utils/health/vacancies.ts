import {DefaultTheme} from 'styled-components/native';

export function getVacancieHealth(
  taken: number,
  available: number,
  inverse = false,
): {
  status: keyof DefaultTheme['COLORS'];
  percentage: number;
} {
  try {
    const percentage = !inverse ? 1 - taken / available : taken / available;

    if (percentage < 0.5) {
      return {status: 'CRITICAL', percentage};
    }

    if (percentage < 0.8) {
      return {status: 'BAD', percentage};
    }
    return {status: 'GOOD', percentage};
  } catch (err) {
    return {status: 'GOOD', percentage: -1};
  }
}
