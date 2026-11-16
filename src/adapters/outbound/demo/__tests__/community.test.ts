import { createDemoClock } from '../clock';
import { ENROLLED } from '../data/enrolled';
import { TEACHERS } from '../data/student';
import {
  createDemoMessageBoard,
  createDemoTeacherDirectory,
} from '../ports/community';

const NOW = new Date(2026, 2, 15, 10, 0);
const clock = () => createDemoClock(() => NOW.getTime(), 0);
const THREAD = {
  subjectId: 'IME02-10892',
  classNumber: '2',
  period: '2026.1',
};

describe('demo message board', () => {
  it('shows seeded messages of the current period, with tolerant codes', async () => {
    const board = createDemoMessageBoard(clock());
    const messages = await board.read(THREAD);
    expect(messages.length).toBeGreaterThan(2);
    messages.forEach(message => {
      expect(message.period).toBe('2026.1');
      expect(new Date(message.createdAt).getTime()).toBeLessThan(NOW.getTime());
    });
    await expect(
      board.read({ ...THREAD, subjectId: '10892', classNumber: '02' }),
    ).resolves.toHaveLength(messages.length);
    await expect(board.read({ ...THREAD, period: '2025.2' })).resolves.toEqual(
      [],
    );
    await expect(board.read({ ...THREAD, classNumber: '1' })).resolves.toEqual(
      [],
    );
  });

  it('keeps posted messages in memory', async () => {
    const board = createDemoMessageBoard(clock());
    const thread = {
      subjectId: 'IME02-10933',
      classNumber: '1',
      period: '2026.1',
    };
    await expect(board.read(thread)).resolves.toEqual([]);
    const posted = await board.post({
      ...thread,
      authorName: 'Alex Demonstração',
      text: 'Olá, turma!',
    });
    expect(posted).toMatchObject({
      text: 'Olá, turma!',
      createdAt: NOW.toISOString(),
    });
    await expect(board.read(thread)).resolves.toEqual([posted]);
  });

  it('cancels and returns copies', async () => {
    const board = createDemoMessageBoard(clock());
    const controller = new AbortController();
    controller.abort();
    await expect(
      board.read(THREAD, { signal: controller.signal }),
    ).rejects.toMatchObject({ code: 'CANCELLED' });
    const first = await board.read(THREAD);
    first[0].text = 'mudado';
    expect((await board.read(THREAD))[0].text).not.toBe('mudado');
  });
});

describe('demo teacher directory', () => {
  it('lists only invented teachers, with the classes they teach', async () => {
    const directory = createDemoTeacherDirectory(clock());
    const names = await directory.list();
    expect(names.length).toBeGreaterThan(5);
    names.forEach(name =>
      expect(TEACHERS as readonly string[]).toContain(name),
    );
    for (const subject of ENROLLED) {
      const teacher = await directory.find(subject.teacher.toUpperCase());
      expect(
        teacher?.subjects
          .find(item => item.id === subject.id)
          ?.classes.some(item => item.number === subject.class),
      ).toBe(true);
    }
    await expect(directory.find('Ninguém')).resolves.toBeNull();
  });

  it('works without a clock, as the composition creates it', async () => {
    jest.useFakeTimers();
    try {
      const pending = createDemoTeacherDirectory().list();
      jest.advanceTimersByTime(300);
      await expect(pending).resolves.not.toHaveLength(0);
    } finally {
      jest.useRealTimers();
    }
  });
});
