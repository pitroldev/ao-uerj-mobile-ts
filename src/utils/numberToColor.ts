export function numberToColor(current: unknown, base = 10, inverse = false) {
  if (typeof current !== 'number') {
    return 'CANCELED';
  }

  const target = inverse ? base - current : current;
  const percent = target / base;

  if (percent >= 0.7) {
    return 'GOOD';
  }
  if (percent >= 0.5) {
    return 'BAD';
  }

  return 'CRITICAL';
}
