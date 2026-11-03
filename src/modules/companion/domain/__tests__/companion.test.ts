import type { AttendedClassesSchedule } from '@root/modules/academics/domain/models';
import {
  canJoin,
  firstNameOf,
  hasContact,
  isValidName,
  similarCall,
  type CompanionCall,
  type Membership,
} from '../companion';
import { buildCompanionReminderPlan } from '../reminders';
import {
  classAt,
  customTime,
  freeWindow,
  latestMinute,
  timeOptions,
  watchUntil,
} from '../window';

const MINUTE = 60_000;

describe('o recado combina o encontro, não o contato', () => {
  it.each([
    'me chama no 21 99876-5432',
    '(21) 3456 7890',
    'insta @julia',
    'whatsapp na bio',
    'manda zap',
    'https://exemplo.com',
    'grupo em t.me/uerj',
  ])('recusa "%s"', text => expect(hasContact(text)).toBe(true));

  it.each([
    'Mesa perto da entrada, 12:30',
    'Depois da prova de Química; papo leve.',
    'A pé pelo Portão 1',
    'Sala 6019 B até 13:50',
  ])('aceita "%s"', text => expect(hasContact(text)).toBe(false));
});

describe('o primeiro nome', () => {
  it('sai do nome da conta, com acento e sem sobrenome', () => {
    expect(firstNameOf('MARINA ALBUQUERQUE TEIXEIRA')).toBe('Marina');
    expect(firstNameOf('  joão pedro')).toBe('João');
    expect(firstNameOf("D'ÁVILA")).toBe("D'ávila");
    expect(firstNameOf('123')).toBe('');
  });

  it('vale uma palavra só, de letras, como o servidor aceita', () => {
    expect(isValidName('Júlia')).toBe(true);
    expect(isValidName('Ana-Clara')).toBe(true);
    for (const name of ['', 'Ana Paula', 'ana1', '@ana', 'a'.repeat(21)])
      expect(isValidName(name)).toBe(false);
  });
});

it('entra quem chega antes de a chamada sair e enquanto há vaga', () => {
  const call = {
    going: 3,
    capacity: 4,
    listedUntil: 10 * MINUTE,
  } as CompanionCall;
  expect(canJoin(call, 5 * MINUTE)).toBe(true);
  expect(canJoin(call, 10 * MINUTE)).toBe(false);
  expect(canJoin({ ...call, going: 4 }, 5 * MINUTE)).toBe(false);
});

/** Uma aula da grade: o portal manda o dia de 1 (segunda) a 6. */
function lesson(
  name: string,
  day: number,
  start: string,
  end: string,
  room = `Sala 6019 B`,
): AttendedClassesSchedule {
  const minutes = (time: string) => {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  };
  return {
    class: {
      id: name,
      name,
      class: '1',
      avaLocation: '',
      uerjLocation: `Pav. João Lyra Filho · 6º andar · ${room}`,
      status: 'OK',
    },
    dayAlias: '',
    dayNumber: day,
    subject_id: name,
    periodAlias: 'T3',
    startTimeAlias: start,
    endTimeAlias: end,
    start_time_in_minutes: minutes(start),
    end_time_in_minutes: minutes(end),
  };
}

// segunda, 23 de novembro de 2026
const monday = (h: number, m: number) => new Date(2026, 10, 23, h, m);
const at = (h: number, m: number) => monday(h, m).getTime();
const SCHEDULE = [
  lesson('Cálculo II', 1, '14:20', '16:00'),
  lesson('Álgebra Linear', 1, '16:10', '17:50', 'Sala 6031 B'),
  lesson('Cinema Brasileiro', 1, '20:30', '22:10', 'Sala 9027 D'),
  lesson('Física III', 2, '07:50', '09:40'),
];

describe('a janela vem da grade', () => {
  it('livre até a próxima aula, em aula, depois da última ou sem aula', () => {
    expect(freeWindow(SCHEDULE, monday(12, 5))).toMatchObject({
      kind: 'free',
      next: { name: 'Cálculo II', start: 14 * 60 + 20 },
      last: { name: 'Cinema Brasileiro' },
    });
    expect(freeWindow(SCHEDULE, monday(15, 0))).toMatchObject({
      kind: 'class',
      current: { name: 'Cálculo II', end: 16 * 60 },
    });
    expect(freeWindow(SCHEDULE, monday(22, 12))).toMatchObject({
      kind: 'done',
      last: { end: 22 * 60 + 10 },
    });
    expect(freeWindow(SCHEDULE, new Date(2026, 10, 25, 12, 0))).toEqual({
      kind: 'none',
    });
  });

  it('ignora aula cancelada e horário fora da tabela', () => {
    const canceled = {
      ...lesson('Cálculo II', 1, '14:20', '16:00'),
      class: {
        ...lesson('Cálculo II', 1, '14:20', '16:00').class,
        status: 'CANCELED',
      },
    };
    const unknown = {
      ...lesson('Sem horário', 1, '10:00', '11:00'),
      start_time_in_minutes: -1,
    };
    expect(freeWindow([canceled, unknown], monday(15, 0))).toEqual({
      kind: 'none',
    });
  });
});

const clock = (ms: number) => {
  const date = new Date(ms);
  return `${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
};

describe('os horários que a folha oferece', () => {
  it('a mesa vai nos quartos de hora e termina 40 minutos antes da próxima aula', () => {
    const now = monday(12, 5);
    const options = timeOptions('lunch', freeWindow(SCHEDULE, now), now);
    expect(options.map(clock)).toEqual([
      '12:15',
      '12:30',
      '12:45',
      '13:00',
      '13:15',
      '13:30',
    ]);
    // quem abre às 12:08 vê os mesmos horários de quem abriu às 12:02
    const other = monday(12, 2);
    expect(
      timeOptions('lunch', freeWindow(SCHEDULE, other), other).map(clock),
    ).toEqual(['12:15', '12:30', '12:45', '13:00', '13:15', '13:30']);
    // às 13:30, só o que termina antes das 13:40
    const later = monday(13, 30);
    expect(
      timeOptions('lunch', freeWindow(SCHEDULE, later), later).map(clock),
    ).toEqual(['13:40']);
  });

  it('em aula, a mesa começa depois dela', () => {
    const now = monday(15, 0);
    expect(
      timeOptions('lunch', freeWindow(SCHEDULE, now), now).map(clock),
    ).toEqual(['16:00']);
  });

  it('a volta parte do fim da última aula do dia, de 5 em 5', () => {
    const now = monday(21, 40);
    expect(
      timeOptions('home', freeWindow(SCHEDULE, now), now).map(clock),
    ).toEqual(['22:10', '22:15', '22:20', '22:25', '22:35']);
    const after = monday(22, 12);
    expect(
      timeOptions('home', freeWindow(SCHEDULE, after), after).map(clock),
    ).toEqual(['22:15', '22:20', '22:25', '22:30', '22:40']);
  });

  it('nada passa de 3 horas à frente nem da meia-noite', () => {
    const now = monday(23, 40);
    const options = timeOptions('home', freeWindow(SCHEDULE, now), now);
    expect(options.map(clock)).toEqual(['23:45', '23:50', '23:55']);
    const morning = monday(9, 0);
    const lunch = timeOptions('home', freeWindow(SCHEDULE, morning), morning);
    expect(
      lunch.every(option => option <= morning.getTime() + 3 * 60 * MINUTE),
    ).toBe(true);
  });
});

describe('os avisos da chamada', () => {
  const membership = (extra: Partial<Membership> = {}): Membership => ({
    callId: 'c1',
    memberKey: 'k',
    host: false,
    kind: 'home',
    at: monday(22, 15).getTime(),
    spot: 'concha',
    destination: 'metro',
    expiresAt: monday(22, 15).getTime() + 120 * MINUTE,
    ...extra,
  });
  const text = (_: Membership, key: string) => ({ title: key, body: '' });

  it('10 minutos antes e, na volta, o "Chegou bem?" 40 minutos depois', () => {
    const plan = buildCompanionReminderPlan([membership()], {
      now: monday(21, 0).getTime(),
      text,
    });
    expect(plan.reminders.map(item => [item.title, clock(item.at)])).toEqual([
      ['soon', '22:05'],
      ['arrived', '22:55'],
    ]);
    expect(plan.reminders[0].local).toEqual({
      at: '2026-11-23T22:05',
      until: '2026-11-23T22:15',
    });
  });

  it('quem entra a menos de 10 minutos não recebe o de antes; a mesa não tem o de depois', () => {
    const plan = buildCompanionReminderPlan(
      [
        membership(),
        membership({ callId: 'c2', kind: 'lunch', destination: null }),
      ],
      { now: monday(22, 8).getTime(), text },
    );
    expect(plan.reminders.map(item => [item.callId, item.title])).toEqual([
      ['c1', 'arrived'],
    ]);
  });

  it('o "Chegou bem?" atrasado ainda vale até a chamada sumir', () => {
    const late = monday(23, 30).getTime();
    const plan = buildCompanionReminderPlan([membership()], {
      now: late,
      text,
    });
    expect(plan.reminders).toHaveLength(1);
    expect(plan.reminders[0].at).toBe(late);
    expect(
      buildCompanionReminderPlan([membership()], {
        now: monday(22, 15).getTime() + 121 * MINUTE,
        text,
      }).reminders,
    ).toEqual([]);
  });
});

describe('o horário digitado ("Outro horário")', () => {
  it('vale de agora até 3 horas daqui, no mesmo dia', () => {
    const now = monday(10, 0);
    expect(customTime(now, 12 * 60 + 30)).toEqual({ at: at(12, 30) });
    expect(customTime(now, 9 * 60 + 30)).toEqual({ refused: 'past' });
    expect(customTime(now, 10 * 60)).toEqual({ refused: 'past' });
    expect(customTime(now, 13 * 60 + 30)).toEqual({ refused: 'late' });
    expect(latestMinute(now)).toBe(12 * 60 + 59);
    // perto da meia-noite, o limite é o fim do dia
    expect(latestMinute(monday(22, 30))).toBe(23 * 60 + 59);
  });

  it('diz quando o horário cai numa aula da grade', () => {
    const now = monday(12, 5);
    expect(classAt(SCHEDULE, now, 15 * 60)).toMatchObject({
      name: 'Cálculo II',
      end: 16 * 60,
    });
    expect(classAt(SCHEDULE, now, 13 * 60)).toBeNull();
    // a aula acaba às 16:00: nesse minuto já não está em aula
    expect(classAt(SCHEDULE, now, 16 * 60)).toBeNull();
  });
});

describe('a chamada parecida, para entrar em vez de abrir outra', () => {
  const listed = (extra: Partial<CompanionCall>): CompanionCall => ({
    id: 'a',
    kind: 'lunch',
    at: at(12, 15),
    spot: 'ru',
    destination: null,
    note: '',
    host: 'Júlia',
    going: 2,
    capacity: 6,
    listedUntil: at(12, 45),
    expiresAt: at(12, 45),
    ...extra,
  });
  const now = at(12, 5);

  it('o mesmo ponto até 15 minutos de diferença, com vaga; a mais perto primeiro', () => {
    const calls = [
      listed({ id: 'longe', at: at(12, 30) }),
      listed({ id: 'perto', at: at(12, 20), going: 1 }),
      listed({ id: 'cheia', at: at(12, 15), going: 6 }),
      listed({ id: 'lago', at: at(12, 15), spot: 'lago' }),
    ];
    const choice = {
      kind: 'lunch' as const,
      spot: 'ru' as const,
      at: at(12, 15),
      destination: null,
    };
    expect(similarCall(calls, choice, now)?.id).toBe('perto');
    // no empate de horário, a que tem mais gente
    expect(
      similarCall(
        [listed({ id: 'um', going: 1 }), listed({ id: 'tres', going: 3 })],
        choice,
        now,
      )?.id,
    ).toBe('tres');
    // meia hora depois já é outra mesa
    expect(similarCall(calls, { ...choice, at: at(12, 50) }, now)).toBeNull();
  });

  it('na volta, só com o mesmo destino', () => {
    const home = listed({
      id: 'v',
      kind: 'home',
      spot: 'concha',
      destination: 'metro',
      at: at(22, 15),
      listedUntil: at(22, 25),
    });
    const choice = {
      kind: 'home' as const,
      spot: 'concha' as const,
      at: at(22, 15),
    };
    expect(
      similarCall([home], { ...choice, destination: 'metro' }, at(22, 0))?.id,
    ).toBe('v');
    expect(
      similarCall([home], { ...choice, destination: 'trem' }, at(22, 0)),
    ).toBeNull();
  });
});

describe('até quando o "Me avise" vigia a lista', () => {
  it('a mesa, até 40 minutos antes da próxima aula; a volta, 40 minutos depois da última', () => {
    const lunch = monday(12, 5);
    expect(
      clock(watchUntil('lunch', freeWindow(SCHEDULE, lunch), lunch)!),
    ).toBe('13:40');
    const night = monday(21, 40);
    expect(clock(watchUntil('home', freeWindow(SCHEDULE, night), night)!)).toBe(
      '22:50',
    );
    // perto do limite, não vale pedir
    const late = monday(13, 30);
    expect(watchUntil('lunch', freeWindow(SCHEDULE, late), late)).toBeNull();
    // sem aula no dia: a mesa nas próximas 2 horas, a volta na próxima hora
    const free = new Date(2026, 10, 25, 11, 0);
    expect(clock(watchUntil('lunch', freeWindow(SCHEDULE, free), free)!)).toBe(
      '13:00',
    );
    expect(clock(watchUntil('home', freeWindow(SCHEDULE, free), free)!)).toBe(
      '12:00',
    );
    // nunca passa da meia-noite
    const midnight = monday(23, 30);
    expect(
      clock(watchUntil('home', freeWindow(SCHEDULE, midnight), midnight)!),
    ).toBe('23:59');
  });
});
