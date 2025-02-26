const cheerio = require('react-native-cheerio');

import {PartialRID} from './types';

import {parseSubjectName, parseSubjectID} from '@services/parser/minorParser';

export default function parsePartialRID(html: string) {
  const $ = cheerio.load(html);

  const subjects: PartialRID[] = [];
  let ridSubject = {} as Partial<PartialRID>;

  if (!$('div div td').text()) {
    return {
      subjects,
      updatedAt: '',
    };
  }

  $('div div td').text((index: number, text: string) => {
    if (index % 6 === 0) {
      ridSubject.id = parseSubjectID(text);
      ridSubject.name = parseSubjectName(text);
    }

    if ((index - 1) % 6 === 0) {
      ridSubject.classNumber = text.trim();
    }
    if ((index - 2) % 6 === 0) {
      ridSubject.available = parseInt(text.trim(), 10);
    }
    if ((index - 3) % 6 === 0) {
      ridSubject.requested = parseInt(text.trim(), 10);
    }
    if ((index - 4) % 6 === 0) {
      ridSubject.position = parseInt(text.trim(), 10);
    }
    if ((index - 5) % 6 === 0) {
      ridSubject.status = text.trim();
      subjects.push(ridSubject as PartialRID);
      ridSubject = {};
    }
  });

  const updatedAt = $('div div:nth-child(1) b').first().text();

  console.log('updated at', updatedAt);

  return {
    subjects,
    updatedAt,
  };
}
