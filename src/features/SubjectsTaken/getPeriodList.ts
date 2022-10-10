import {SubjectAttended} from '@root/features/SubjectsTaken/types';

function calculateCR(data: SubjectAttended[]) {
  const filteredData = data.filter(v => v.grade !== null && v.credits !== null);
  const credits = filteredData.reduce(
    (acc, cur) => acc + (cur.credits ?? 0),
    0,
  );
  const gradesTimesCredits = filteredData.reduce(
    (acc, cur) => acc + (cur.grade ?? 0) * (cur.credits ?? 0),
    0,
  );

  const CR = parseFloat((gradesTimesCredits / credits).toFixed(2));
  return CR;
}

function calculatePeriodWithCR(data: SubjectAttended[], periodList: string[]) {
  periodList.reverse();

  const options = periodList.map((period, index) => {
    if (period.toLowerCase().includes('isent')) {
      return {
        label: period,
        value: period,
      };
    }

    const filteredData = data.filter(v => {
      const periodIndex = periodList.indexOf(v.period);
      return periodIndex <= index;
    });

    const CR = calculateCR(filteredData);

    const isActual = index === periodList.length - 1;
    return {
      label: `${period} - CR${isActual ? ' Atual' : ''}: ${CR}`,
      value: period,
    };
  });

  options.reverse();
  return options;
}

export function getPeriodList(data: SubjectAttended[]) {
  const uniqueList = [...new Set(data.map(c => c.period as string))];

  const sortedList = uniqueList.sort((a, b) => {
    if (a.toLowerCase().includes('isent')) {
      return 10;
    }
    if (b.toLowerCase().includes('isent')) {
      return -10;
    }

    if (a < b) {
      return 1;
    }
    if (a > b) {
      return -1;
    }
    return 0;
  });

  const options = calculatePeriodWithCR(data, sortedList);

  return options;
}
