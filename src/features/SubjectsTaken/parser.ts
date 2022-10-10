import {SubjectAttended} from '@root/features/SubjectsTaken/types';
import {
  parseSubjectType,
  parseUerjNumber,
} from '../../services/parser/minorParser';

const cheerio = require('react-native-cheerio');

export default function parseSubjectsTaken(html: string): SubjectAttended[] {
  try {
    const $ = cheerio.load(html);

    let hasIsentos = false;
    const regexPeriodo = /\d{4}[/]\d/g;
    const disciplinaCodes = [] as {code: string; disciplina: string}[];

    $('td:nth-child(8)').text((index: number, text: string) => {
      if (text.includes('Isento')) {
        hasIsentos = true;
      }
    });

    let disciplinaObj = {} as Partial<SubjectAttended>;
    let disciplinasArray: SubjectAttended[] = [];
    let counter = 0;

    $('div tr+ tr td .LINKNAOSUB').each((index: number, node: any) => {
      const numberRegex = /\d+/g;
      const onClickString = node.attribs.onclick;
      const [code] = numberRegex.exec(onClickString) as RegExpExecArray;
      const disciplina = node.children[2].data.trim();
      disciplinaCodes.push({disciplina, code});
    });

    // Disciplinas // #titulo+ table td
    let currentPeriodo = '';
    const MOD = 8;
    $('div tr+ tr td').text((index: number, text: string) => {
      if (regexPeriodo.test(text)) {
        counter += 1;
        currentPeriodo = text.replace('/', '.').trim();
      }

      const diff = hasIsentos ? index - counter - 1 : index - counter;
      if (diff % MOD === 0) {
        disciplinaObj.name = text.trim();
        const disciplinaCode = disciplinaCodes.find(
          v => v.disciplina === text.trim(),
        );
        disciplinaObj.id = disciplinaCode?.code as string;
      }

      if ((diff - 1) % MOD === 0) {
        disciplinaObj.credits = parseUerjNumber(text);
      }
      if ((diff - 2) % MOD === 0) {
        disciplinaObj.workload = parseUerjNumber(text);
      }
      if ((diff - 3) % MOD === 0) {
        disciplinaObj.type = parseSubjectType(text);
      }
      if ((diff - 4) % MOD === 0) {
        disciplinaObj.frequency = parseUerjNumber(text.replace('%', '').trim());
      }
      if ((diff - 5) % MOD === 0) {
        disciplinaObj.grade = parseUerjNumber(text.replace(',', '.').trim());
      }
      if ((diff - 6) % MOD === 0) {
        if (text.toLowerCase().includes('cancel')) {
          disciplinaObj.status = 'CANCELED';
        }
        if (text.toLowerCase().includes('freq')) {
          disciplinaObj.status = 'FAILED_BY_ATTENDANCE';
        }
        if (text.toLowerCase().includes('nota')) {
          disciplinaObj.status = 'FAILED_BY_GRADE';
        }
        if (text.toLowerCase().includes('aprov')) {
          disciplinaObj.status = 'APPROVED';
        }

        if (!!disciplinaObj.name && currentPeriodo) {
          disciplinaObj.period = currentPeriodo;
          disciplinasArray.push(disciplinaObj as SubjectAttended);
        }
        if (!currentPeriodo) {
          disciplinaObj.status = 'EXEMPT';
          disciplinaObj.period = 'Isento';
          disciplinasArray.push(disciplinaObj as SubjectAttended);
        }
        disciplinaObj = {};
      }
    });

    return disciplinasArray;
  } catch (err) {
    throw new Error('ParseError');
  }
}
