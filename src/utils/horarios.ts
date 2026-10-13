import { Turno } from '@root/types/dateStuff';

export function orderTurnosStringToArray(turnoString: string): any[] {
  let ordered = turnoString.split(/\s/g);
  ordered = ordered.filter(item => item);
  ordered = ordered.map(item => {
    return item.replace(/M/g, 'A').replace(/T/g, 'B').replace(/N/g, 'C').trim();
  });
  ordered = ordered.sort();
  ordered = ordered.map(item => {
    return item.replace(/A/g, 'M').replace(/B/g, 'T').replace(/C/g, 'N').trim();
  });

  return ordered;
}

function convertTempoToNumber(tempos: string[]) {
  const preNumbered = tempos.map(t =>
    t.replace('M', '').replace('T', '6+').replace('N', '12+').split('+'),
  );

  const numberedTempos = preNumbered.map(c =>
    c.reduce((sum, part) => sum + parseFloat(part), 0),
  );
  return numberedTempos;
}

export function searchForBreakPonts(tempos: Turno[]) {
  const numberedTempos = convertTempoToNumber(tempos);

  const { length } = numberedTempos;
  const firstNum = numberedTempos[0];
  const lastNum = numberedTempos[length - 1];
  const hipoteticalLenght = lastNum - firstNum + 1;
  const totalWithoutBreaks = (hipoteticalLenght * (firstNum + lastNum)) / 2;

  const realTotal = numberedTempos.reduce((a, b) => a + b);

  if (realTotal === totalWithoutBreaks) {
    return [tempos];
  } else {
    const breakPoints = [] as any;
    for (let i = 0; i < numberedTempos.length - 1; i++) {
      const actual = numberedTempos[i];
      const next = numberedTempos[i + 1];
      if (actual + 1 !== next && breakPoints[breakPoints.length - 1] !== i) {
        breakPoints.push(i + 1);
      }
    }
    breakPoints.unshift(0);
    breakPoints.push(numberedTempos.length);

    const breakedTempos = [];

    for (let i = 0; i < breakPoints.length - 1; i++) {
      const actual = breakPoints[i];
      const next = breakPoints[i + 1];
      const slicedTempo = tempos.slice(actual, next);
      breakedTempos.push(slicedTempo);
    }
    return breakedTempos;
  }
}
