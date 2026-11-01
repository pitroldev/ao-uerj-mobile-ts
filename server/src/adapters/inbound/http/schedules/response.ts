import type { GenerationResult } from '../../../../modules/schedules/domain/model.ts';
import type { GenerateSchedulesResponse } from '../contract.ts';
import type { GenerationBody } from './request.ts';

/**
 * As grades no formato do gerador antigo: cada turma é a do pedido (com os
 * campos que o app mandou) mais a disciplina dela.
 */
export function toGenerationResponse(
  result: GenerationResult,
  wire: GenerationBody,
): GenerateSchedulesResponse {
  return {
    data: result.schedules.map(schedule => ({
      hash: schedule.hash,
      schedule: schedule.classes.map(({ classIndex, subjectIndex }) => ({
        ...wire.classes[classIndex],
        subject: wire.subjects[subjectIndex],
      })),
      total_week_days: schedule.weekDays,
      total_credits: schedule.credits,
      total_workload: schedule.workload,
      fails: { subject_amount: false },
      total_gaps_in_minutes: schedule.gapMinutes,
    })),
    exhaustive: result.exhaustive,
  };
}
