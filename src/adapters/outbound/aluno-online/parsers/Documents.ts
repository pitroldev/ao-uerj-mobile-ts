import type { StudentDocument } from '@root/modules/documents/domain/models';
import { AppError } from '@root/shared/errors/AppError';
import type { CheerioAPI } from '../html';

type DocumentAction = {
  requisition: string;
  identification: string;
  option: string;
  subOption: string;
};

type PortalDocument = {
  document: StudentDocument;
  issue?: DocumentAction;
  remove?: DocumentAction;
};

export type DocumentCatalog = {
  token: string;
  entries: PortalDocument[];
};

const clean = (text: string) => text.replace(/\s+/g, ' ').trim();
const controlSelector =
  'a, button, input, select, textarea, [onclick], [role="button"]';
const actionPattern =
  /^\s*(?:javascript:\s*)?enviarRequisicao\(\s*formOpcao\s*,\s*([12])\s*,\s*['"]([\w-]+)['"]\s*,\s*['"]([\w.-]+)['"]\s*,\s*(\d+)\s*,\s*(\d+)\s*\)\s*;?\s*(?:return false;?)?\s*$/;

/** Parse the portal's form, never execute its inline JavaScript. Session-only
 * requisitions and CSRF tokens stay inside this outbound adapter. */
export function parseDocumentCatalog($: CheerioAPI): DocumentCatalog {
  const form = $('form[name="formOpcao"]');
  const token = form.find('input[name="_token"]').attr('value');
  if (
    form.length !== 1 ||
    form.attr('method')?.toLowerCase() !== 'post' ||
    !token ||
    !form.find('input[name="identificacaoDocumento"]').length ||
    !form.find('input[name="subOpcaoDocumento"]').length
  ) {
    throw new AppError('PORTAL_LAYOUT_CHANGED');
  }
  const headers = form.find('tr').filter((_index, row) => {
    const texts = $(row)
      .children('td, th')
      .toArray()
      .map(cell => clean($(cell).text()));
    return texts.includes('Identificação') && texts.includes('Validade');
  });
  const table = headers.closest('table');
  if (headers.length !== 1 || table.length !== 1)
    throw new AppError('PORTAL_LAYOUT_CHANGED');
  const entries: PortalDocument[] = [];
  let hasHeader = false;
  const seen = new Set<string>();
  let spanningTitle: { title: string; remaining: number } | undefined;
  table.find('tr').each((_index, row) => {
    if ($(row).closest('table')[0] !== table[0]) return;
    const cells = $(row).children('td, th');
    const texts = cells.toArray().map(cell => clean($(cell).text()));
    if (row === headers[0]) {
      hasHeader = true;
      return;
    }
    if (!hasHeader) return;
    const controls = cells
      .find(controlSelector)
      .add(cells.filter('[onclick], [role="button"]'));
    if (cells.toArray().some(cell => $(cell).find('table').length)) {
      if (controls.length) throw new AppError('PORTAL_LAYOUT_CHANGED');
      return;
    }
    // Only inherit a title for the number of rows actually covered by rowspan.
    // Otherwise a malformed row could execute one document's action under the
    // preceding document's title, including in a deletion confirmation.
    const offset = cells.length === 4 && spanningTitle ? -1 : 0;
    if (cells.length !== 5 && offset === 0) {
      if (controls.length) throw new AppError('PORTAL_LAYOUT_CHANGED');
      return;
    }
    if (cells.length === 5 && spanningTitle)
      throw new AppError('PORTAL_LAYOUT_CHANGED');
    const title = offset === -1 ? spanningTitle!.title : texts[0];
    if (!title || title.length > 200)
      throw new AppError('PORTAL_LAYOUT_CHANGED');
    if (offset === -1) {
      spanningTitle!.remaining -= 1;
      if (!spanningTitle!.remaining) spanningTitle = undefined;
    } else {
      const rowspan = cells.first().attr('rowspan') ?? '1';
      if (!/^[1-9]\d*$/.test(rowspan))
        throw new AppError('PORTAL_LAYOUT_CHANGED');
      const remaining = Number(rowspan) - 1;
      if (!Number.isSafeInteger(remaining))
        throw new AppError('PORTAL_LAYOUT_CHANGED');
      if (remaining) spanningTitle = { title, remaining };
    }
    const actions: Partial<Record<'issue' | 'remove', DocumentAction>> = {};
    const links = cells.slice(3 + offset).find('a');
    const recognizedLinks = new Set(links.toArray());
    if (controls.toArray().some(control => !recognizedLinks.has(control)))
      throw new AppError('PORTAL_LAYOUT_CHANGED');
    links.each((_i, link) => {
      const match = actionPattern.exec($(link).attr('onclick') ?? '');
      if (!match) throw new AppError('PORTAL_LAYOUT_CHANGED');
      const [, operation, requisition, identification, option, subOption] =
        match;
      const key = operation === '1' ? 'issue' : 'remove';
      if (actions[key]) throw new AppError('PORTAL_LAYOUT_CHANGED');
      actions[key] = { requisition, identification, option, subOption };
    });
    const action = actions.issue ?? actions.remove;
    if (
      actions.issue &&
      actions.remove &&
      ['identification', 'option', 'subOption'].some(
        key =>
          actions.issue![key as keyof DocumentAction] !==
          actions.remove![key as keyof DocumentAction],
      )
    )
      throw new AppError('PORTAL_LAYOUT_CHANGED');
    const id = action
      ? `${action.option}:${action.subOption}:${action.identification}`
      : `unavailable:${entries.length}`;
    if (seen.has(id)) throw new AppError('PORTAL_LAYOUT_CHANGED');
    seen.add(id);
    // A document can remain visible while the portal withholds all actions.
    // Its observed identifier still proves that it exists; losing the buttons
    // is not evidence that an earlier deletion succeeded.
    const identification = action?.identification ?? texts[1 + offset];
    if (identification && !/^[\w.-]+$/.test(identification))
      throw new AppError('PORTAL_LAYOUT_CHANGED');
    const revision =
      identification && identification !== '0' ? identification : null;
    const validity = texts[2 + offset];
    entries.push({
      document: {
        id,
        title,
        validUntil: /^\d{2}\/\d{2}\/\d{4}$/.test(validity) ? validity : null,
        hasExistingDocument: revision !== null,
        canIssue: Boolean(actions.issue),
        canDelete: Boolean(actions.remove && revision),
        revision,
      },
      ...actions,
    });
  });
  if (!hasHeader || spanningTitle) throw new AppError('PORTAL_LAYOUT_CHANGED');
  return { token, entries };
}

export function documentFormParams(action: DocumentAction, token: string) {
  return {
    requisicao: action.requisition,
    identificacaoDocumento: action.identification,
    opcao: action.option,
    subOpcaoDocumento: action.subOption,
    _token: token,
  };
}

/** PDF URLs contain private identifiers. Accept only the observed AO temp
 * directory, without forwarding cookies to another host or arbitrary path. */
export function parseDocumentPdfPath($: CheerioAPI): string {
  const frames = $('iframe[src]');
  if (frames.length !== 1) throw new AppError('PORTAL_LAYOUT_CHANGED');
  const src = frames.attr('src')?.trim() ?? '';
  const match =
    /^(?:\.\.\/|\/|https:\/\/www\.alunoonline\.uerj\.br\/)tmp\/([a-zA-Z0-9_-][a-zA-Z0-9_.-]*\.pdf)$/.exec(
      src,
    );
  if (!match || match[1].includes('..'))
    throw new AppError('PORTAL_LAYOUT_CHANGED');
  return `/tmp/${match[1]}`;
}
