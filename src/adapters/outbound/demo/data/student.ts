/*
 * O aluno fictício da conta de demonstração: Ciência da Computação, no 8º
 * período. Nomes de alunos e professores são inventados de propósito, com
 * sobrenomes que não deixam dúvida (Exemplo, Fictício, Modelo…).
 */

export const DEMO_STUDENT_NAME = 'Alex Demonstração';

/** Períodos já cursados antes do atual: o corrente é o 8º. */
export const PAST_PERIODS = 7;

/** Professores inventados, usados nas turmas e no diretório. */
export const TEACHERS = [
  'Ana Exemplo',
  'Bruno Fictício',
  'Carla Modelo',
  'Diego Amostra',
  'Elisa Protótipo',
  'Fábio Simulado',
  'Gabriela Ensaio',
  'Hugo Rascunho',
  'Irene Esboço',
  'João Hipotético',
  'Laura Imaginária',
  'Marcos Inventado',
] as const;

export type TeacherName = (typeof TEACHERS)[number];

/** Salas que o mapa do campus sabe achar (Pavilhão João Lyra Filho). */
export const ROOMS = {
  A6002: 'Pav. João Lyra Filho · 6º andar · Sala 6002 A',
  B6019: 'Pav. João Lyra Filho · 6º andar · Sala 6019 B',
  F6029: 'Pav. João Lyra Filho · 6º andar · Sala 6029 F',
  F6037: 'Pav. João Lyra Filho · 6º andar · Sala 6037 F',
  D6113: 'Pav. João Lyra Filho · 6º andar · Sala 6113 D',
  E6121: 'Pav. João Lyra Filho · 6º andar · Sala 6121 E',
  C9033: 'Pav. João Lyra Filho · 9º andar · Sala 9033 C',
  A10025: 'Pav. João Lyra Filho · 10º andar · Sala 10025 A',
  B11030: 'Pav. João Lyra Filho · 11º andar · Sala 11030 B',
} as const;
