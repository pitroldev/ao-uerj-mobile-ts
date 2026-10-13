export function parseName(name: string, NomeCompleto = true) {
  try {
    let splitStr = name.trim().toLowerCase().split(' ');
    for (let i = 0; i < splitStr.length; i++) {
      splitStr[i] =
        splitStr[i].charAt(0).toUpperCase() + splitStr[i].substring(1);
    }
    name = splitStr.join(' ');
    if (NomeCompleto === true) {
      return name;
    }
    const separado = name.split(' ');
    const preposicao = `${separado[1]}`;
    if (preposicao.length <= 3 && separado[2] !== undefined) {
      return `${separado[0]} ${separado[1]} ${separado[2]}`;
    }
    if (separado[1] !== undefined) {
      return `${separado[0]} ${separado[1]}`;
    } else {
      return `${separado[0]}`;
    }
  } catch {
    return name;
  }
}
