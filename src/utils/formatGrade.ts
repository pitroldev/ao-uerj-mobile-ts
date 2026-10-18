/**
 * Nota ou média como o app mostra: "8,5", com uma casa e, quando existe, a
 * segunda ("7,75"). Corta na segunda casa em vez de arredondar, para uma nota
 * abaixo de 5 (ou de 7) nunca aparecer como "5,0" (ou "7,0").
 */
export function formatGrade(value: number): string {
  const hundredths = Math.floor(value * 100 + 1e-6);
  return (hundredths / 100)
    .toFixed(hundredths % 10 === 0 ? 1 : 2)
    .replace('.', ',');
}
