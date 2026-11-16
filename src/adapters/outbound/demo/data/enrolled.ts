/*
 * As disciplinas do período corrente: segunda a sábado, com aulas de manhã,
 * de tarde e de noite, para "Próxima aula" ter sempre o que mostrar. As notas
 * são de meio de período: P1 lançada, P2 por vir.
 */
import type { Grade } from '@root/modules/academics/domain/models';
import { ROOMS, type TeacherName } from './student';
import type { Meeting } from './time';

export type Enrolled = {
  id: string;
  /** Turma, em texto como no portal ("2"). */
  class: string;
  uerjLocation: string;
  /** Sala virtual do AVA, além da física. */
  avaLocation?: string;
  meetings: Meeting[];
  teacher: TeacherName;
  grades: Grade;
};

export const ENROLLED: Enrolled[] = [
  {
    id: 'IME02-10892',
    class: '2',
    uerjLocation: ROOMS.F6037,
    meetings: [
      { day: 1, from: 'T3', to: 'T4' },
      { day: 3, from: 'T3', to: 'T4' },
    ],
    teacher: 'Elisa Protótipo',
    grades: { p1: 8.5, p2: null, pf: null, result: null },
  },
  {
    id: 'IME02-10905',
    class: '3',
    uerjLocation: ROOMS.A6002,
    meetings: [{ day: 1, from: 'M3', to: 'M4' }],
    teacher: 'Irene Esboço',
    grades: { p1: 9.5, p2: null, pf: null, result: null },
  },
  {
    id: 'IME02-11024',
    class: '1',
    uerjLocation: ROOMS.F6029,
    meetings: [
      { day: 1, from: 'N1', to: 'N2' },
      { day: 3, from: 'N1', to: 'N2' },
    ],
    teacher: 'Hugo Rascunho',
    grades: { p1: 9.2, p2: null, pf: null, result: null },
  },
  {
    id: 'IME02-10871',
    class: '1',
    uerjLocation: ROOMS.D6113,
    avaLocation: 'SALA12IMECOMP',
    meetings: [
      { day: 2, from: 'M3', to: 'M4' },
      { day: 4, from: 'M3', to: 'M4' },
    ],
    teacher: 'Bruno Fictício',
    grades: { p1: 6, p2: null, pf: null, result: null },
  },
  {
    id: 'IME04-10933',
    class: '1',
    uerjLocation: ROOMS.B6019,
    meetings: [
      { day: 2, from: 'T1', to: 'T2' },
      { day: 4, from: 'T1', to: 'T2' },
    ],
    teacher: 'Carla Modelo',
    // abaixo de 4,0: a P2 precisa ser alta para ainda haver PF
    grades: { p1: 3.5, p2: null, pf: null, result: null },
  },
  {
    id: 'IME02-11040',
    class: '1',
    uerjLocation: ROOMS.E6121,
    meetings: [
      { day: 2, from: 'N1', to: 'N2' },
      { day: 5, from: 'N1', to: 'N2' },
    ],
    teacher: 'Fábio Simulado',
    grades: { p1: 7.8, p2: null, pf: null, result: null },
  },
  {
    id: 'IME02-10950',
    class: '1',
    uerjLocation: ROOMS.F6037,
    meetings: [{ day: 5, from: 'T3', to: 'T4' }],
    teacher: 'Diego Amostra',
    // ainda sem nota: o projeto só é avaliado no fim
    grades: { p1: null, p2: null, pf: null, result: null },
  },
  {
    id: 'ILE01-10322',
    class: '1',
    uerjLocation: ROOMS.B11030,
    meetings: [
      { day: 4, from: 'M5', to: 'M6' },
      { day: 6, from: 'M1', to: 'M4' },
    ],
    teacher: 'Gabriela Ensaio',
    grades: { p1: 7, p2: null, pf: null, result: null },
  },
];
