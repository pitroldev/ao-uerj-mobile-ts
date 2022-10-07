export function generateHash(matricula: string, password: string): string {
  const orderedJoin = [...matricula.split(''), password.split('')]
    .sort()
    .join('');

  const hexHash = orderedJoin
    .split('')
    .map(char => {
      const hex = char.charCodeAt(0).toString(16);
      return hex.length === 1 ? `0${hex}` : hex;
    })
    .join('');

  return hexHash;
}
