import Share from 'react-native-share';
import type { DocumentSharingPort } from '@root/modules/documents/application/ports';
import type { DocumentPdf } from '@root/modules/documents/domain/models';

let sequence = 0;

/** PDFs remain in the private cache until Android clears it. The selected
 * receiver may read the content URI after Share.open has already resolved. */
export class NativeDocumentSharing implements DocumentSharingPort {
  async share(document: DocumentPdf): Promise<void> {
    sequence += 1;
    await Share.open({
      url: `data:application/pdf;base64,${document.base64}`,
      type: 'application/pdf',
      // Never expose a portal-provided name or overwrite another receiver's
      // pending file. Neither timestamp nor sequence identifies the student.
      filename: `documento-uerj-${Date.now()}-${sequence}`,
      useInternalStorage: true,
      failOnCancel: false,
    });
  }
}
