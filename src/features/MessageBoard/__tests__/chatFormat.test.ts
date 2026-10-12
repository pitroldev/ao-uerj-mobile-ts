import type { Message } from '@root/modules/community/domain/models';
import {
  dayLabel,
  firstLink,
  groupByDay,
  isOwnMessage,
  threadSummary,
  timeLabel,
} from '../chatFormat';
import {
  defaultMessagePeriod,
  messagePeriodOptions,
  portalPeriod,
  suggestedPeriod,
} from '../messagePeriod';

const NOW = new Date(2026, 9, 13, 11, 58);
const at = (day: number, hour: number, minute = 0, month = 9, year = 2026) =>
  new Date(year, month, day, hour, minute).toISOString();
const message = (id: string, createdAt: string, authorName = 'Beatriz Nunes') =>
  ({
    id,
    authorName,
    subjectId: 'IME02-10892',
    classNumber: '2',
    period: '2026.2',
    text: `Mensagem ${id}`,
    createdAt,
  } satisfies Message);

describe('chat formatting', () => {
  it('labels days like a conversation app', () => {
    expect(dayLabel(new Date(2026, 9, 13, 8), NOW)).toBe('Hoje');
    expect(dayLabel(new Date(2026, 9, 12, 23), NOW)).toBe('Ontem');
    expect(dayLabel(new Date(2026, 9, 9, 21), NOW)).toBe('Sexta, 9 de outubro');
    expect(dayLabel(new Date(2025, 2, 3), NOW)).toBe(
      'Segunda, 3 de março de 2025',
    );
    expect(dayLabel(null, NOW)).toBe('Data desconhecida');
    expect(timeLabel(new Date(2026, 9, 9, 8, 2))).toBe('08:02');
  });

  it('groups consecutive messages by day without reordering them', () => {
    const groups = groupByDay(
      [
        message('1', at(9, 21, 14)),
        message('2', at(10, 8, 2)),
        message('3', at(10, 9, 40)),
        message('4', at(13, 9, 0)),
      ],
      NOW,
    );
    expect(groups.map(g => g.label)).toEqual([
      'Sexta, 9 de outubro',
      'Sábado, 10 de outubro',
      'Hoje',
    ]);
    expect(groups.map(g => g.messages.map(m => m.id))).toEqual([
      ['1'],
      ['2', '3'],
      ['4'],
    ]);
    expect(new Set(groups.map(g => g.key)).size).toBe(3);
  });

  it('recognizes the student messages by the account name', () => {
    const mine = message('1', at(9, 1), 'Marina  Albuquerque');
    expect(isOwnMessage(mine, 'marina albuquerque')).toBe(true);
    expect(isOwnMessage(mine, 'Beatriz Nunes')).toBe(false);
    expect(isOwnMessage(mine, undefined)).toBe(false);
  });

  it('summarizes a thread with its count and latest date', () => {
    expect(threadSummary([])).toBe('Nenhuma mensagem ainda');
    expect(threadSummary([message('1', at(9, 21))])).toBe(
      '1 mensagem · última em 09/10/2026',
    );
    expect(
      threadSummary([message('1', at(12, 19)), message('2', at(9, 21))]),
    ).toBe('2 mensagens · última em 12/10/2026');
  });

  it('finds the first web link of a message', () => {
    expect(firstLink('Grupo: https://chat.whatsapp.com/x e mais')).toBe(
      'https://chat.whatsapp.com/x',
    );
    expect(firstLink('sem link')).toBeNull();
  });
});

describe('message period', () => {
  it('prefers the portal period and falls back to the calendar', () => {
    expect(portalPeriod({ period: '2026.2' })).toBe('2026.2');
    expect(portalPeriod({ period: 'current' })).toBeNull();
    expect(suggestedPeriod(new Date(2026, 5, 30))).toBe('2026.1');
    expect(suggestedPeriod(NOW)).toBe('2026.2');
    expect(defaultMessagePeriod({ period: 'current' }, NOW)).toBe('2026.2');
    expect(defaultMessagePeriod(null, new Date(2026, 1, 1))).toBe('2026.1');
  });

  it('offers the selected period and the last six semesters, newest first', () => {
    expect(messagePeriodOptions('2026.2', NOW)).toEqual([
      '2026.2',
      '2026.1',
      '2025.2',
      '2025.1',
      '2024.2',
      '2024.1',
    ]);
    expect(messagePeriodOptions('2019.1', NOW)).toContain('2019.1');
  });
});
