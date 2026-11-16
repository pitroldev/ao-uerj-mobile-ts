/*
 * Os documentos da "Emissão de Documentos". O id segue o do adaptador real
 * ("opção:subopção:identificação", com "0" quando ainda não há documento),
 * e a validade vem do relógio.
 */
import type { StudentDocument } from '@root/modules/documents/domain/models';
import type { DemoClock } from '../clock';
import { portalDate } from './time';

/** Dias de validade de um documento emitido na demonstração. */
export const VALIDITY_DAYS = 30;

type DocumentType = { option: string; title: string };

export type DocumentSlot = DocumentType & {
  /** Identificação do documento emitido; `null` se ainda não há um. */
  revision: string | null;
  validUntil: string | null;
};

const DOCUMENT_TYPES: DocumentType[] = [
  { option: '5:0', title: 'Declaração de Matrícula' },
  { option: '8:0', title: 'Histórico Escolar' },
  { option: '6:0', title: 'Declaração de Inscrição em Disciplinas' },
  { option: '9:0', title: 'Grade de Horários' },
];

/** Dois já emitidos (um perto de vencer) e dois para emitir. */
export function initialDocuments(clock: DemoClock): DocumentSlot[] {
  const issued: Record<string, [revision: string, days: number]> = {
    '8:0': ['demo-historico', 45],
    '6:0': ['demo-inscricao', 12],
  };
  return DOCUMENT_TYPES.map(type => {
    const existing = issued[type.option];
    return {
      ...type,
      revision: existing?.[0] ?? null,
      validUntil: existing ? portalDate(clock.daysFromNow(existing[1])) : null,
    };
  });
}

export function toStudentDocument(slot: DocumentSlot): StudentDocument {
  return {
    id: `${slot.option}:${slot.revision ?? '0'}`,
    title: slot.title,
    validUntil: slot.validUntil,
    hasExistingDocument: slot.revision !== null,
    canIssue: true,
    canDelete: slot.revision !== null,
    revision: slot.revision,
  };
}
