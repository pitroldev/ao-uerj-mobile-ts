import type { Teacher } from './domain.ts';

/** Porta de entrada: a lista e a busca de docentes. */
export interface TeacherDirectory {
  /** Os nomes, em ordem alfabética do português. */
  names(): Promise<string[]>;
  /** Até `SEARCH_LIMIT` docentes cujo nome contém o texto. */
  search(fragment: string): Promise<Teacher[]>;
}

/** Porta de saída: onde os docentes ficam. */
export interface TeacherRepository {
  listNames(): Promise<string[]>;
  /** Nomes que contêm o texto (literal, sem distinguir maiúsculas). */
  searchByName(fragment: string, limit: number): Promise<Teacher[]>;
}
