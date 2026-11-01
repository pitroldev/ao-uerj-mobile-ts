/** Docentes da UERJ e as turmas de cada um, como o banco os guarda. */
export type Teacher = {
  id: string;
  name: string;
  /**
   * Por código de disciplina, o nome e as turmas. Passa adiante como veio:
   * os apps publicados leem esse formato.
   */
  subjects: unknown;
  createdAt?: Date;
  updatedAt?: Date;
};

export const TEACHER_NAME_LIMITS = { minimum: 2, maximum: 200 } as const;

/** A busca devolve no máximo estes. */
export const SEARCH_LIMIT = 50;

/** A lista de nomes em ordem alfabética do português. */
export function sortNames(names: readonly string[]): string[] {
  return [...names].sort((first, second) =>
    first.localeCompare(second, 'pt-BR'),
  );
}
