/*
 * A inscrição do período: o RID Parcial (com a classificação de cada pedido)
 * e o resultado final, com uma disciplina não aceita e o motivo, nos textos
 * que o portal usa.
 */
import type {
  EnrollmentResult,
  PartialRidResult,
} from '@root/modules/academics/domain/models';
import type { DemoClock } from '../clock';
import { catalogEntry } from './catalog';
import { ENROLLED } from './enrolled';
import { portalDateTime } from './time';

/** Pedida, mas sem o pré-requisito: Projeto Final I ainda está em curso. */
const REFUSED = {
  id: 'IME02-10951',
  classNumber: '1',
  reason: 'Falta Requisito (CO/PRE)',
};

export function partialRid(clock: DemoClock): PartialRidResult {
  const accepted = ENROLLED.map((subject, index) => {
    const available = 30 + (index % 3) * 5;
    return {
      id: subject.id,
      name: catalogEntry(subject.id).name,
      classNumber: subject.class,
      available,
      requested: available + 8 - index * 3,
      position: 3 + index * 4,
      status: 'Classificado',
    };
  });
  const refused = {
    id: REFUSED.id,
    name: catalogEntry(REFUSED.id).name,
    classNumber: REFUSED.classNumber,
    available: 25,
    requested: 31,
    position: 29,
    status: 'Excedente',
  };
  // atualizado há pouco: dentro dos 30 dias em que o app o trata como atual
  const updated = clock.daysFromNow(-2, 14);
  updated.setMinutes(32);
  return {
    updatedAt: portalDateTime(updated),
    subjects: [...accepted, refused],
  };
}

export function enrollmentResult(): EnrollmentResult {
  return {
    subjects: [
      ...ENROLLED.map(subject => ({
        id: subject.id,
        name: catalogEntry(subject.id).name,
        classNumber: subject.class,
        accepted: true,
        reason: '',
      })),
      {
        id: REFUSED.id,
        name: catalogEntry(REFUSED.id).name,
        classNumber: REFUSED.classNumber,
        accepted: false,
        reason: REFUSED.reason,
      },
    ],
  };
}
