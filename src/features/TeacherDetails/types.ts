export interface Horario {
  Quinta?: Array<string[]>;
  Sexta?: Array<string[]>;
}

export interface Turma {
  turma: string;
  local: string;
  horarios: Horario[];
}

export interface Disciplina {
  disciplina: string;
  turmas: Turma[];
}

export interface Docente {
  _id: string;
  docente: string;
  disciplinas: { [code: string]: Disciplina };
  createdAt: string;
  __v: number;
}
