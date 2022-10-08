export type Grade = {
  p1?: number | null;
  p2?: number | null;
  pf?: number | null;
  result?: number | null;
};

export type ClassGrade = {
  id: string;
  name: string;
  class: number | string;
  grades: Grade;
};
