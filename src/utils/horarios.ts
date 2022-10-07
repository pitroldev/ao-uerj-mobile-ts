import {Turno} from '@root/types/dateStuff';
import {TIME_DICTIONARY} from '@utils/constants/time';

export function convertTempoHorario(tempo: string): string[] {
  if (!TIME_DICTIONARY[tempo]) {
    return ['??:??', '??:??'];
  }

  return TIME_DICTIONARY[tempo];
}

export function minutesToStr(minutes: number) {
  return `${Math.floor(minutes / 60).toLocaleString('en-US', {
    minimumIntegerDigits: 2,
    useGrouping: false,
  })}:${(minutes % 60).toLocaleString('en-US', {
    minimumIntegerDigits: 2,
    useGrouping: false,
  })}`;
}

export function strToMinutes(str: string) {
  const [hours, minutes] = str.split(':').map(Number);
  return hours * 60 + minutes;
}

export function convertDayToNumber(day: string): number {
  switch (day) {
    case 'Segunda':
      return 0;
    case 'Terça':
      return 1;
    case 'Quarta':
      return 2;
    case 'Quinta':
      return 3;
    case 'Sexta':
      return 4;
    case 'Sábado':
      return 5;
    case 'Domingo':
      return 6;
    default:
      return 7;
  }
}

export function convertNumberToDay(number: number) {
  switch (number) {
    case 0:
      return 'Segunda';
    case 1:
      return 'Terça';
    case 2:
      return 'Quarta';
    case 3:
      return 'Quinta';
    case 4:
      return 'Sexta';
    case 5:
      return 'Sábado';
    case 6:
      return 'Domingo';
    default:
      return 'Erro';
  }
}

export function convertTurnoToColor(turno: string) {
  const colorRegex = /\D/g;
  const firstLetter = colorRegex.exec(turno)[0];
  switch (firstLetter) {
    case 'M':
      return '#FBFFD5';
    case 'T':
      return '#FFF4D5';
    case 'N':
      return '#D5F8FF';
    default:
      return '#ddd';
  }
}

export function orderTurnosStringToArray(turnoString: string): any[] {
  let ordered = turnoString.split(/\s/g);
  ordered = ordered.filter(item => item && item);
  ordered = ordered.map(item => {
    return item.replace(/M/g, 'A').replace(/T/g, 'B').replace(/N/g, 'C').trim();
  });
  ordered = ordered.sort();
  ordered = ordered.map(item => {
    return item.replace(/A/g, 'M').replace(/B/g, 'T').replace(/C/g, 'N').trim();
  });

  return ordered;
}

export function convertTempoToNumber(tempos: string[]) {
  const preNumbered = tempos.map(t =>
    t.replace('M', '').replace('T', '6+').replace('N', '12+').split('+'),
  );

  const numberedTempos = preNumbered.map(c =>
    parseFloat(c.reduce((a, b) => parseFloat(a) + parseFloat(b))),
  );
  return numberedTempos;
}

export function searchForBreakPonts(tempos: Turno[]) {
  const numberedTempos = convertTempoToNumber(tempos);

  const {length} = numberedTempos;
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
