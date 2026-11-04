import type { AttendedClassesSchedule } from '@root/modules/academics/domain/models';
import type { CampusNotice } from '../campusNow';
import {
  askTarget,
  classSpots,
  nearReason,
  onCampusToday,
  roomClasses,
  spotsAt,
  suggestedPlace,
} from '../nearby';

/** Segunda, 23/11/2026, às 14:10, no fuso do aparelho. */
const MONDAY = new Date(2026, 10, 23, 14, 10);

function lesson(
  name: string,
  location: string,
  dayNumber: number,
  start: number,
  end: number,
  status = 'ACTIVE',
): AttendedClassesSchedule {
  return {
    class: { name, uerjLocation: location, status } as never,
    dayAlias: '',
    dayNumber,
    subject_id: name,
    periodAlias: '',
    startTimeAlias: '',
    endTimeAlias: '',
    start_time_in_minutes: start,
    end_time_in_minutes: end,
  };
}

const SCHEDULE = [
  lesson('Cálculo II', 'Sala 6019 - Bloco B', 1, 14 * 60 + 20, 16 * 60),
  lesson('Álgebra Linear', '6031 B', 1, 16 * 60 + 10, 17 * 60 + 50),
  lesson('Física III', '3025 F', 2, 7 * 60 + 50, 9 * 60 + 40),
  lesson('Química', 'Haroldinho 310', 1, 10 * 60, 12 * 60),
  lesson('Online', 'AVA', 1, 8 * 60, 9 * 60),
  lesson('Cancelada', '9002 C', 1, 14 * 60, 15 * 60, 'CANCELED'),
];

function notice(partial: Partial<CampusNotice> = {}): CampusNotice {
  return {
    id: 'n1',
    kind: 'elevators',
    status: 'long_queue',
    place: { type: 'elevators' },
    createdAt: MONDAY.getTime() - 20 * 60_000,
    expiresAt: MONDAY.getTime() + 40 * 60_000,
    state: 'active',
    confirmations: 3,
    ends: 0,
    confirmed: true,
    level: null,
    mine: false,
    answer: null,
    thanked: false,
    flagged: false,
    views: null,
    thanks: null,
    ...partial,
  };
}

describe('as salas da grade', () => {
  it('guarda só as aulas com horário nas salas do Pavilhão, sem as canceladas', () => {
    expect(roomClasses(SCHEDULE)).toEqual([
      {
        weekday: 1,
        start: 860,
        end: 960,
        room: '6019',
        block: 'B',
        floor: '6',
      },
      {
        weekday: 1,
        start: 970,
        end: 1070,
        room: '6031',
        block: 'B',
        floor: '6',
      },
      {
        weekday: 2,
        start: 470,
        end: 580,
        room: '3025',
        block: 'F',
        floor: '3',
      },
    ]);
  });

  it('a aula de agora e a próxima que começa em até 40 minutos', () => {
    // 14:10: a caminho da aula das 14:20
    expect(classSpots(SCHEDULE, MONDAY)).toEqual([
      {
        start: 860,
        end: 960,
        room: '6019',
        block: 'B',
        floor: '6',
        live: false,
      },
    ]);
    // 15:40: em aula até 16:00, e a próxima às 16:10
    const later = new Date(2026, 10, 23, 15, 40);
    expect(
      classSpots(SCHEDULE, later).map(spot => [spot.room, spot.live]),
    ).toEqual([
      ['6019', true],
      ['6031', false],
    ]);
    // 13:00: nada por perto; terça cedo: Física no F
    expect(classSpots(SCHEDULE, new Date(2026, 10, 23, 13, 0))).toEqual([]);
    expect(
      spotsAt(roomClasses(SCHEDULE), new Date(2026, 10, 24, 7, 20)).map(
        spot => spot.room,
      ),
    ).toEqual(['3025']);
  });

  it('está no campus de 1 h antes da primeira aula até 30 min depois da última', () => {
    expect(onCampusToday(SCHEDULE, new Date(2026, 10, 23, 7, 0))).toBe(true);
    expect(onCampusToday(SCHEDULE, new Date(2026, 10, 23, 6, 30))).toBe(false);
    expect(onCampusToday(SCHEDULE, new Date(2026, 10, 23, 18, 20))).toBe(true);
    expect(onCampusToday(SCHEDULE, new Date(2026, 10, 23, 18, 30))).toBe(false);
    // domingo, sem aula
    expect(onCampusToday(SCHEDULE, new Date(2026, 10, 22, 14, 0))).toBe(false);
  });
});

describe('perto de você', () => {
  const spots = classSpots(SCHEDULE, MONDAY);

  it('os elevadores para quem tem aula do 3º andar para cima, o mesmo andar e a mesma sala', () => {
    expect(nearReason(notice(), spots)?.reason).toBe('elevators');
    expect(
      nearReason(
        notice({ place: { type: 'floor', block: 'B', floor: '6' } }),
        spots,
      )?.reason,
    ).toBe('floor');
    expect(
      nearReason(
        notice({
          place: { type: 'room', block: 'B', floor: '6', room: '6019' },
        }),
        spots,
      )?.reason,
    ).toBe('room');
    // outro andar, outro bloco, o bandejão e o portão não saem da grade
    expect(
      nearReason(
        notice({ place: { type: 'floor', block: 'B', floor: '5' } }),
        spots,
      ),
    ).toBeNull();
    expect(
      nearReason(
        notice({ place: { type: 'floor', block: 'A', floor: '6' } }),
        spots,
      ),
    ).toBeNull();
    expect(nearReason(notice({ place: { type: 'ru' } }), spots)).toBeNull();
    expect(
      nearReason(
        notice({ place: { type: 'gate', gate: 'portao-sfx' } }),
        spots,
      ),
    ).toBeNull();
  });

  it('ninguém pergunta dos elevadores a quem tem aula no térreo ou no 2º andar', () => {
    const low = spotsAt(
      [
        {
          weekday: 1,
          start: 860,
          end: 960,
          room: '2010',
          block: 'A',
          floor: '2',
        },
      ],
      MONDAY,
    );
    expect(nearReason(notice(), low)).toBeNull();
  });

  it('pergunta do aviso do caminho que o aluno não respondeu nem dispensou, o confirmado primeiro', () => {
    const now = MONDAY.getTime();
    const fresh = notice({
      id: 'novo',
      place: { type: 'floor', block: 'B', floor: '6' },
      kind: 'restroom',
      status: 'no_water',
      confirmed: false,
      confirmations: 0,
      createdAt: now - 60_000,
    });
    const lift = notice({ id: 'elevador' });
    expect(
      askTarget([fresh, lift], spots, { skipped: [], now })?.notice.id,
    ).toBe('elevador');
    // respondido, dispensado, do próprio aluno ou vencido: não pergunta
    expect(
      askTarget([fresh, { ...lift, answer: 'confirm' }], spots, {
        skipped: [],
        now,
      })?.notice.id,
    ).toBe('novo');
    expect(
      askTarget([fresh, lift], spots, { skipped: ['elevador', 'novo'], now }),
    ).toBeNull();
    expect(
      askTarget([{ ...lift, mine: true }], spots, { skipped: [], now }),
    ).toBeNull();
    expect(
      askTarget([{ ...lift, expiresAt: now - 1 }], spots, { skipped: [], now }),
    ).toBeNull();
    // o celular só pergunta dos confirmados
    expect(
      askTarget([fresh], spots, { skipped: [], now, confirmedOnly: true }),
    ).toBeNull();
    // quem tocou no aviso do celular encontra a mesma pergunta na tela
    expect(
      askTarget([fresh, lift], spots, { skipped: [], now, prefer: ['novo'] })
        ?.notice.id,
    ).toBe('novo');
    expect(
      askTarget([fresh, lift], spots, {
        skipped: [],
        now,
        prefer: ['novo', 'elevador'],
      })?.notice.id,
    ).toBe('elevador');
  });

  it('o lugar da folha de avisar vem da grade, e o hall e o bandejão são fixos', () => {
    expect(suggestedPlace('elevators', 'stopped', [])).toEqual({
      type: 'elevators',
    });
    expect(suggestedPlace('ru', 'long_queue', [])).toEqual({ type: 'ru' });
    expect(suggestedPlace('power', 'no_power', spots)).toEqual({
      type: 'floor',
      block: 'B',
      floor: '6',
    });
    expect(suggestedPlace('access', 'room_locked', spots)).toEqual({
      type: 'room',
      block: 'B',
      floor: '6',
      room: '6019',
    });
    // sem aula por perto, ou no portão: o aluno escolhe
    expect(suggestedPlace('internet', 'wifi_down', [])).toBeNull();
    expect(suggestedPlace('access', 'gate_closed', spots)).toBeNull();
  });
});
