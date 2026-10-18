import { finalExamOutlook } from '@root/modules/academics/domain/rules/finalExam';
import { outlookText, stepGrade } from '../finalExamText';

const text = (grades: Parameters<typeof finalExamOutlook>[0]) =>
  outlookText(finalExamOutlook(grades));

it('says what each subject needs to pass by grade', () => {
  expect(text({ p1: 5.5, p2: 6.1 })).toEqual({
    label: 'Precisa de 4,2 na PF',
    tone: 'warn',
  });
  expect(text({ p1: 4, p2: 4.4 })).toEqual({
    label: 'Precisa de 5,8 na PF',
    tone: 'bad',
  });
  expect(text({ p1: 8, p2: 7.4 })).toEqual({
    label: 'Dispensado da PF',
    tone: 'good',
  });
  expect(text({ p1: 3.2, p2: 4 })).toEqual({
    label: 'Sem direito à PF',
    tone: 'bad',
  });
});

it('tells what the missing exam needs', () => {
  expect(text({ p1: 7.5 })).toEqual({
    label: '6,5 na P2 dispensa a PF',
    tone: 'info',
  });
  expect(text({ p2: 3 })).toEqual({
    label: 'Precisa de 5,0 na P1 para ter PF',
    tone: 'bad',
  });
});

it('shows the final grade once the exam is graded', () => {
  expect(text({ p1: 5, p2: 5, pf: 6 })).toEqual({
    label: 'Média final 5,5',
    tone: 'good',
  });
  expect(text({ p1: 5.5, p2: 6.2, pf: 4.1 })).toEqual({
    // 4,975 corta em 4,97: abaixo de 5 nunca aparece como 4,98 arredondado
    label: 'Média final 4,97',
    tone: 'bad',
  });
});

it('says whether the published average passes, like the computed one', () => {
  expect(text({ result: 5.5 })).toEqual({
    label: 'Média final 5,5',
    tone: 'good',
  });
  expect(text({ result: 4.95 })).toEqual({
    label: 'Média final 4,95',
    tone: 'bad',
  });
});

it('leaves empty rows and a final exam without both exams to the health label', () => {
  expect(text({})).toBeNull();
  expect(text({ p1: 7.5, pf: 6 })).toBeNull();
});

it('steps simulated grades by halves, snapping to round values', () => {
  expect(stepGrade(4.2, 1)).toBe(4.5);
  expect(stepGrade(4.5, 1)).toBe(5);
  expect(stepGrade(4.2, -1)).toBe(4);
  expect(stepGrade(4, -1)).toBe(3.5);
  expect(stepGrade(9.8, 1)).toBe(10);
  expect(stepGrade(10, 1)).toBe(10);
  expect(stepGrade(0.3, -1)).toBe(0);
  expect(stepGrade(0, -1)).toBe(0);
});
