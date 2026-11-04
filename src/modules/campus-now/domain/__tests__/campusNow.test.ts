import {
  floorsOf,
  monthOf,
  NOTICE_KINDS,
  NOTICE_STATUSES,
  placeKey,
  placeTypeOf,
  previousMonth,
  STATUSES_BY_KIND,
} from '../campusNow';
import { badgesOf, leveledUp, levelProgress, pointsToNext } from '../progress';

describe('os tipos e os lugares', () => {
  it('cada situação pede um tipo de lugar', () => {
    expect(placeTypeOf('elevators', 'stopped')).toBe('elevators');
    expect(placeTypeOf('ru', 'closed')).toBe('ru');
    expect(placeTypeOf('power', 'no_ac')).toBe('floor');
    expect(placeTypeOf('restroom', 'closed')).toBe('floor');
    expect(placeTypeOf('access', 'gate_closed')).toBe('gate');
    expect(placeTypeOf('access', 'ramp_closed')).toBe('floor');
    expect(placeTypeOf('access', 'room_locked')).toBe('room');
  });

  it('as listas são as do servidor, sem repetir situação', () => {
    expect(NOTICE_KINDS).toHaveLength(6);
    expect(new Set(NOTICE_STATUSES).size).toBe(NOTICE_STATUSES.length);
    expect(STATUSES_BY_KIND.internet).toEqual(['wifi_down', 'wifi_slow']);
  });

  it('o semienterrado só existe no F', () => {
    expect(floorsOf('F')).toEqual([
      'SE',
      'T',
      ...Array.from({ length: 12 }, (_, i) => String(i + 1)),
    ]);
    expect(floorsOf('A')[0]).toBe('T');
    expect(floorsOf('A')).toHaveLength(13);
  });

  it('o mesmo lugar tem a mesma chave', () => {
    expect(placeKey({ type: 'elevators' })).toBe('elevators');
    expect(placeKey({ type: 'gate', gate: 'portao-sfx' })).toBe(
      'gate:portao-sfx',
    );
    expect(placeKey({ type: 'floor', block: 'B', floor: '6' })).toBe(
      'floor:B:6',
    );
    expect(
      placeKey({ type: 'room', block: 'B', floor: '6', room: '6019' }),
    ).toBe('room:B:6019');
  });

  it('o mês de agora e o anterior, com a virada do ano', () => {
    expect(monthOf(new Date(2026, 10, 23))).toBe('2026-11');
    expect(previousMonth('2026-11')).toBe('2026-10');
    expect(previousMonth('2027-01')).toBe('2026-12');
  });
});

describe('pontos, nível e conquistas', () => {
  const standing = { points: 290, level: 2, levelAt: 100, nextLevelAt: 300 };

  it('o caminho até o próximo nível e o que falta', () => {
    expect(levelProgress(standing)).toBeCloseTo(0.95);
    expect(pointsToNext(standing)).toBe(10);
    const top = { points: 2400, level: 5, levelAt: 2000, nextLevelAt: null };
    expect(levelProgress(top)).toBe(1);
    expect(pointsToNext(top)).toBeNull();
  });

  it('as conquistas saem das contagens de sempre', () => {
    const badges = badgesOf({
      you: standing,
      counts: {
        notices: 6,
        answers: 12,
        confirmedNotices: 4,
        thanksReceived: 41,
        viewsReceived: 312,
      },
    });
    expect(badges.map(badge => [badge.id, badge.done, badge.progress])).toEqual(
      [
        ['first', true, 1],
        ['checker', false, 12],
        ['helped', true, 100],
        ['trusted', false, 2],
      ],
    );
  });

  it('o nível novo só conta depois da primeira leitura', () => {
    expect(leveledUp(null, { level: 3 })).toBe(false);
    expect(leveledUp({ level: 2 }, { level: 3 })).toBe(true);
    expect(leveledUp({ level: 3 }, { level: 3 })).toBe(false);
  });
});
