/**
 * Larguras do Inter (por 1000 unidades do corpo), medidas no Chrome com as
 * mesmas fontes do app. O SVG não mede texto: é com elas que a imagem da
 * semana quebra os nomes nas linhas. Fora desta lista vale a média.
 */
const CHARS =
  '0123456789 !"#$%&\'()*+,-./:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑºª–—·•…’“”«»';

const WIDTHS = {
  'Inter-Regular': [
    631, 407, 610, 618, 646, 593, 620, 566, 619, 620, 281, 288, 466, 633, 642,
    982, 644, 300, 365, 365, 501, 662, 288, 460, 288, 360, 288, 302, 662, 662,
    662, 511, 966, 690, 654, 730, 722, 601, 590, 746, 743, 269, 571, 672, 565,
    903, 753, 765, 639, 765, 644, 642, 646, 744, 690, 985, 682, 679, 629, 365,
    360, 365, 471, 456, 323, 562, 612, 571, 612, 583, 370, 613, 591, 242, 242,
    549, 242, 876, 591, 600, 612, 612, 376, 528, 327, 591, 562, 818, 546, 562,
    552, 426, 333, 426, 662, 562, 562, 562, 562, 562, 583, 583, 583, 583, 242,
    242, 242, 242, 600, 600, 600, 600, 600, 591, 591, 591, 591, 571, 591, 690,
    690, 690, 690, 690, 601, 601, 601, 601, 269, 269, 269, 269, 765, 765, 765,
    765, 765, 744, 744, 744, 744, 730, 753, 482, 454, 500, 1000, 288, 563, 864,
    261, 440, 440, 583, 583,
  ],
  'Inter-Medium': [
    646, 415, 616, 627, 656, 603, 630, 571, 629, 630, 267, 304, 495, 639, 646,
    993, 653, 313, 369, 369, 521, 667, 303, 462, 303, 370, 303, 315, 667, 667,
    667, 527, 982, 709, 657, 733, 722, 603, 589, 748, 745, 272, 575, 688, 565,
    913, 756, 767, 642, 769, 648, 646, 653, 740, 709, 1003, 701, 696, 641, 369,
    370, 369, 477, 463, 337, 568, 618, 577, 618, 587, 379, 620, 602, 252, 252,
    559, 252, 888, 602, 604, 618, 618, 387, 539, 340, 602, 575, 829, 557, 575,
    559, 440, 346, 440, 667, 568, 568, 568, 568, 568, 587, 587, 587, 587, 252,
    252, 252, 252, 604, 604, 604, 604, 604, 602, 602, 602, 602, 577, 602, 709,
    709, 709, 709, 709, 603, 603, 603, 603, 272, 272, 272, 272, 767, 767, 767,
    767, 767, 740, 740, 740, 740, 733, 756, 485, 457, 500, 1000, 303, 533, 910,
    277, 474, 471, 608, 608,
  ],
  'Inter-SemiBold': [
    660, 423, 623, 636, 666, 612, 640, 576, 640, 640, 252, 321, 523, 644, 650,
    1004, 663, 326, 373, 373, 540, 673, 319, 465, 319, 379, 319, 329, 673, 673,
    673, 543, 999, 728, 659, 737, 722, 605, 588, 749, 746, 277, 580, 703, 565,
    922, 759, 769, 645, 773, 652, 650, 660, 736, 728, 1020, 720, 713, 652, 373,
    379, 373, 481, 469, 351, 574, 624, 583, 624, 591, 389, 625, 612, 262, 262,
    569, 262, 900, 612, 609, 624, 624, 397, 549, 353, 612, 587, 839, 569, 588,
    566, 455, 359, 455, 673, 574, 574, 574, 574, 574, 591, 591, 591, 591, 262,
    262, 262, 262, 609, 609, 609, 609, 609, 612, 612, 612, 612, 583, 612, 728,
    728, 728, 728, 728, 605, 605, 605, 605, 277, 277, 277, 277, 769, 769, 769,
    769, 769, 736, 736, 736, 736, 737, 759, 487, 460, 500, 1000, 319, 503, 956,
    294, 507, 501, 634, 634,
  ],
  'InterDisplay-SemiBold': [
    638, 380, 586, 613, 644, 592, 606, 539, 604, 606, 226, 238, 449, 617, 640,
    906, 634, 266, 321, 321, 513, 646, 236, 439, 236, 351, 236, 239, 646, 646,
    646, 553, 996, 693, 643, 725, 697, 599, 572, 734, 715, 250, 553, 668, 550,
    882, 720, 748, 625, 748, 644, 640, 627, 704, 688, 981, 680, 674, 627, 321,
    351, 321, 455, 468, 277, 541, 587, 544, 587, 553, 349, 587, 573, 232, 233,
    536, 232, 869, 573, 570, 587, 587, 356, 505, 350, 573, 540, 796, 527, 540,
    508, 421, 330, 421, 646, 541, 541, 541, 541, 541, 553, 553, 553, 553, 232,
    232, 232, 232, 570, 570, 570, 570, 570, 573, 573, 573, 573, 544, 573, 693,
    693, 693, 693, 693, 599, 599, 599, 599, 250, 250, 250, 250, 748, 748, 748,
    748, 748, 704, 704, 704, 704, 725, 720, 459, 437, 500, 1000, 236, 452, 709,
    214, 402, 397, 586, 586,
  ],
} as const;

export type FontName = keyof typeof WIDTHS;

const INDEX = new Map(Array.from(CHARS).map((char, i) => [char, i]));

/** Média das letras de cada fonte: o que vale para um caractere fora da lista. */
const AVERAGE = Object.fromEntries(
  (Object.keys(WIDTHS) as FontName[]).map(font => {
    const letters = Array.from('abcdefghijklmnopqrstuvwxyz').map(
      char => WIDTHS[font][INDEX.get(char) as number],
    );
    return [font, letters.reduce((sum, w) => sum + w, 0) / letters.length];
  }),
) as Record<FontName, number>;

/** Largura do texto, nas unidades do desenho. */
export function textWidth(text: string, font: FontName, size: number): number {
  const widths = WIDTHS[font];
  let total = 0;
  for (const char of text) {
    const index = INDEX.get(char);
    total += index === undefined ? AVERAGE[font] : widths[index];
  }
  return (total * size) / 1000;
}

/** Sobra mínima de uma palavra cortada (nada de "Computado-/r"). */
const MIN_REST = 3;

const VOWEL = /[aeiouáàâãéêíóôõúü]/i;
const LETTER = /[a-zà-ÿ]/i;

/**
 * Ponto de corte na fronteira de sílaba mais próxima, até 4 letras antes do
 * que cabe: consoante seguida de vogal ("Teleproces-samento"), sem separar
 * "ch", "lh", "nh" nem os encontros como "pr" e "bl" ("Com-plexo").
 */
function syllableCut(word: string, cut: number): number {
  for (let k = cut; k >= Math.max(2, cut - 4); k -= 1) {
    const here = word[k];
    if (!here || !LETTER.test(here) || VOWEL.test(here)) continue;
    if (!word[k + 1] || !VOWEL.test(word[k + 1])) continue;
    let at = k;
    const before = word[k - 1]?.toLowerCase() ?? '';
    if (here.toLowerCase() === 'h' && 'cln'.includes(before)) at = k - 1;
    if ('lr'.includes(here.toLowerCase()) && 'pbtdcgfv'.includes(before)) {
      at = k - 1;
    }
    if (at >= 2 && word.length - at >= MIN_REST) return at;
  }
  return cut;
}

/**
 * Quebra o texto em até `maxLines` linhas de até `maxWidth`. Uma palavra maior
 * que a linha é cortada com hífen; se o texto não couber, a última linha
 * termina em reticências.
 */
export function wrapText(
  text: string,
  font: FontName,
  size: number,
  maxWidth: number,
  maxLines: number,
): string[] {
  const fits = (line: string) => textWidth(line, font, size) <= maxWidth;
  const queue = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  while (queue.length && lines.length < maxLines) {
    const word = queue[0];
    const candidate = current ? `${current} ${word}` : word;
    if (fits(candidate)) {
      current = candidate;
      queue.shift();
    } else if (current) {
      lines.push(current);
      current = '';
    } else {
      let cut = Math.min(word.length - MIN_REST, word.length - 1);
      while (cut > 1 && !fits(`${word.slice(0, cut)}-`)) cut -= 1;
      cut = syllableCut(word, cut);
      lines.push(`${word.slice(0, cut)}-`);
      queue[0] = word.slice(cut);
    }
  }
  if (current && lines.length < maxLines) {
    lines.push(current);
    current = '';
  }
  if ((current || queue.length) && lines.length) {
    let last = lines[lines.length - 1].replace(/-$/, '');
    while (last && !fits(`${last}…`)) last = last.slice(0, -1).trimEnd();
    lines[lines.length - 1] = `${last}…`;
  }
  return lines;
}
