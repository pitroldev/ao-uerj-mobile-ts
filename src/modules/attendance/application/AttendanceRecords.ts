import type { PreferencesStore } from '@root/modules/identity/application/PreferencesStore';
import {
  setAbsence,
  type Absence,
  type ClassMeeting,
} from '../domain/attendance';

/** Chave das faltas nas preferências da conta (o logout a apaga). */
export const ATTENDANCE_KEY = 'attendance';

/** Faltas por período letivo ("2026.1"): trocar de período começa do zero. */
type StoredAttendance = { version: 1; periods: Record<string, Absence[]> };

const DATE = /^\d{4}-\d{2}-\d{2}$/;

function isAbsence(value: unknown): value is Absence {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.subjectId === 'string' &&
    item.subjectId.length > 0 &&
    typeof item.date === 'string' &&
    DATE.test(item.date) &&
    typeof item.start === 'number' &&
    Number.isInteger(item.start) &&
    typeof item.end === 'number' &&
    Number.isInteger(item.end) &&
    item.end > item.start &&
    typeof item.slots === 'number' &&
    Number.isInteger(item.slots) &&
    item.slots > 0
  );
}

function periodsOf(stored: unknown): Record<string, Absence[]> {
  const periods = (stored as StoredAttendance | null)?.periods;
  return periods && typeof periods === 'object' ? periods : {};
}

function absencesOf(stored: unknown, period: string): Absence[] {
  const list = periodsOf(stored)[period];
  return Array.isArray(list) ? list.filter(isAbsence) : [];
}

/**
 * Faltas marcadas pelo aluno, só no aparelho. O portal não mostra a
 * frequência do período em curso; ela só aparece no histórico.
 */
export class AttendanceRecords {
  constructor(private readonly store: PreferencesStore) {}

  async read(scope: string, period: string): Promise<Absence[]> {
    return absencesOf(await this.store.read(scope, ATTENDANCE_KEY), period);
  }

  /**
   * Marca ou desmarca a falta numa aula e devolve as faltas do período. A
   * leitura e a gravação vão juntas na fila da chave: dois toques seguidos não
   * se sobrescrevem, e a remoção do logout não cai entre as duas.
   */
  async mark(
    scope: string,
    period: string,
    meeting: ClassMeeting,
    absent: boolean,
  ): Promise<Absence[]> {
    const stored = await this.store.update<StoredAttendance>(
      scope,
      ATTENDANCE_KEY,
      current => ({
        version: 1,
        periods: {
          ...periodsOf(current),
          [period]: setAbsence(absencesOf(current, period), meeting, absent),
        },
      }),
    );
    return stored.periods[period];
  }
}
