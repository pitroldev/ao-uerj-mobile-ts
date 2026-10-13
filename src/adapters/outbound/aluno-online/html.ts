import { load, type CheerioAPI } from 'cheerio/slim';
import { parse } from 'parse5';
import {
  adapter,
  type Htmlparser2TreeAdapterMap,
} from 'parse5-htmlparser2-tree-adapter';

export type { Cheerio, CheerioAPI } from 'cheerio/slim';
export type Element = Htmlparser2TreeAdapterMap['element'];

/**
 * The single entry point for portal HTML. Load each response once and hand the
 * document to both session detection and the parser.
 *
 * parse5 builds the tree with the browsers' HTML5 algorithm: implicit
 * `<tbody>`, `<html>` and `<body>`, and foster parenting. The selectors rely on
 * it (e.g. `table > tbody > tr` on pages without `<tbody>`); with the
 * htmlparser2 tree of plain `cheerio/slim`, lists would come back empty
 * without an error. Never import the `cheerio` root: it pulls in undici and
 * node:stream, which break the Metro bundle.
 */
export function loadHtml(html: string): CheerioAPI {
  return load(parse(html, { treeAdapter: adapter }));
}
