import type { DocumentsPort } from '@root/modules/documents/application/ports';
import { AppError } from '@root/shared/errors/AppError';
import { DEMO_CREDENTIALS } from '../account';
import type { DemoClock } from '../clock';
import {
  VALIDITY_DAYS,
  initialDocuments,
  toStudentDocument,
} from '../data/documents';
import { demoPdfBase64 } from '../data/pdf';
import { DEMO_STUDENT_NAME } from '../data/student';
import { portalDate } from '../data/time';

/**
 * A Emissão de Documentos na memória: emitir cria (ou renova) o documento do
 * tipo com validade contada de hoje, e excluir apaga o emitido; o tipo
 * continua na lista para emitir de novo, como no portal.
 */
export function createDemoDocuments(clock: DemoClock): DocumentsPort {
  const slots = initialDocuments(clock);
  let sequence = 0;
  const find = (id: string) =>
    slots.find(slot => toStudentDocument(slot).id === id);

  return {
    list: options =>
      clock.respond(() => slots.map(toStudentDocument), options?.signal),
    issue: (id, options) =>
      clock.respond(() => {
        const slot = find(id);
        if (!slot) throw new AppError('DOCUMENT_UNAVAILABLE');
        const issuedOn = portalDate(new Date(clock.now()));
        sequence += 1;
        slot.revision = `demo-${slot.option.replace(':', '-')}-${sequence}`;
        slot.validUntil = portalDate(clock.daysFromNow(VALIDITY_DAYS));
        return {
          base64: demoPdfBase64({
            title: slot.title,
            studentName: DEMO_STUDENT_NAME,
            matricula: DEMO_CREDENTIALS.matricula,
            issuedOn,
          }),
          filename: `documento-demo-${slot.option.replace(':', '-')}.pdf`,
          mimeType: 'application/pdf' as const,
        };
      }, options?.signal),
    remove: (document, options) =>
      clock.respond(() => {
        const slot = find(document.id);
        // como no adaptador real: só apaga a revisão que o aluno viu
        if (!slot?.revision || slot.revision !== document.revision)
          throw new AppError('DOCUMENT_CHANGED');
        slot.revision = null;
        slot.validUntil = null;
      }, options?.signal),
  };
}
