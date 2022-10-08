export function numberToColor(grade: unknown, base = 10) {
  if (typeof grade !== 'number') {
    return 'CANCELED';
  }

  const percent = grade / base;

  if (percent >= 0.8) {
    return 'GOOD';
  }
  if (percent >= 0.6) {
    return 'BAD';
  }

  return 'CRITICAL';
}
