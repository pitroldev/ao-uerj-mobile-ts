import type { SubjectInfo } from '@root/modules/academics/domain/models';
import { AppError } from '@root/shared/errors/AppError';
import { memoryStore } from '../../__fixtures__/planFixtures';
import {
  PlanPreferencesStore,
  normalizePlanPreferences,
} from '../PlanPreferencesStore';
import {
  PREREQUISITES_KEY,
  PrerequisiteCatalog,
  prerequisiteEntry,
  type CatalogProgress,
} from '../PrerequisiteCatalog';

const details = (
  id: string,
  prerequisite: SubjectInfo['prerequisite'] = [],
): SubjectInfo => ({ id, prerequisite });

describe('prerequisite entries', () => {
  it('keeps "or" groups as numeric codes and reads the credit lock', () => {
    expect(
      prerequisiteEntry(
        details('FEN04-00500', [
          [
            { id: 'ABC01-04826', name: 'Álgebra Linear I' },
            { id: 'ABC01-04825', name: 'Geometria Analítica' },
          ],
          [{ id: 'Trava de Créditos', name: '60 Créditos Obrigatórios' }],
          [],
        ]),
      ),
    ).toEqual({ groups: [['4826', '4825']], creditLock: 60 });
  });
});

describe('prerequisite catalog', () => {
  const fetchAll = jest.fn(async (id: string) =>
    details(id, id.endsWith('2') ? [[{ id: 'FEN04-00001', name: 'A' }]] : []),
  );
  beforeEach(() => fetchAll.mockClear());

  it('reads only what is missing and saves each reading at once', async () => {
    const { store } = memoryStore();
    const catalog = new PrerequisiteCatalog(store);
    const updates: CatalogProgress[] = [];
    const first = await catalog.load(
      'a',
      'v1',
      ['FEN04-00001', 'FEN04-00002'],
      fetchAll,
      new AbortController().signal,
      progress => updates.push(progress),
    );
    expect(first.entries).toEqual({
      '1': { groups: [], creditLock: null },
      '2': { groups: [['1']], creditLock: null },
    });
    expect(updates.at(-1)).toMatchObject({ done: 2, total: 2, failed: [] });

    const again = await catalog.load(
      'a',
      'v1',
      ['FEN04-00001', 'FEN04-00002', 'FEN04-00003'],
      fetchAll,
      new AbortController().signal,
      () => undefined,
    );
    expect(fetchAll).toHaveBeenCalledTimes(3);
    expect(again.total).toBe(1);
    expect(Object.keys(again.entries).sort()).toEqual(['1', '2', '3']);
  });

  it('starts over for another curriculum version', async () => {
    const { store } = memoryStore();
    const catalog = new PrerequisiteCatalog(store);
    await catalog.load(
      'a',
      'v1',
      ['FEN04-00001'],
      fetchAll,
      new AbortController().signal,
      () => undefined,
    );
    expect(await catalog.read('a', 'v2')).toEqual({});
    expect(Object.keys(await catalog.read('a', 'v1'))).toEqual(['1']);
  });

  it('keeps the readings while the curriculum version is unknown', async () => {
    const { store, data } = memoryStore();
    const catalog = new PrerequisiteCatalog(store);
    const load = (curriculum: string | null, ids: string[]) =>
      catalog.load(
        'a',
        curriculum,
        ids,
        fetchAll,
        new AbortController().signal,
        () => undefined,
      );
    // sem a Síntese, e depois com ela: nada se lê de novo
    await load(null, ['FEN04-00001']);
    expect((await load('v1', ['FEN04-00001', 'FEN04-00002'])).total).toBe(1);
    expect(data.get(`a:${PREREQUISITES_KEY}`)).toMatchObject({
      curriculum: 'v1',
    });
    // a Síntese falhou: as leituras da versão guardada continuam valendo
    expect((await load(null, ['FEN04-00003'])).entries).toMatchObject({
      '1': {},
      '2': {},
      '3': {},
    });
    expect(data.get(`a:${PREREQUISITES_KEY}`)).toMatchObject({
      curriculum: 'v1',
    });
    expect(fetchAll).toHaveBeenCalledTimes(3);
  });

  it('stops when the portal asks for a pause and keeps what it read', async () => {
    const { store, data } = memoryStore();
    const fetch = jest
      .fn()
      .mockResolvedValueOnce(details('FEN04-00001'))
      .mockRejectedValueOnce(new AppError('POSSIBLY_BLOCKED'))
      .mockResolvedValue(details('FEN04-00009'));
    const result = await new PrerequisiteCatalog(store, 1).load(
      'a',
      'v1',
      ['FEN04-00001', 'FEN04-00002', 'FEN04-00003'],
      fetch,
      new AbortController().signal,
      () => undefined,
    );
    expect(result.stoppedBy).toBe('POSSIBLY_BLOCKED');
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(Object.keys(result.entries)).toEqual(['1']);
    expect(data.get(`a:${PREREQUISITES_KEY}`)).toMatchObject({
      curriculum: 'v1',
    });
  });

  it('marks a page it could not read and goes on', async () => {
    const { store } = memoryStore();
    const fetch = jest
      .fn()
      .mockRejectedValueOnce(new AppError('PORTAL_LAYOUT_CHANGED'))
      .mockResolvedValue(details('FEN04-00002'));
    const result = await new PrerequisiteCatalog(store, 1).load(
      'a',
      'v1',
      ['FEN04-00001', 'FEN04-00002'],
      fetch,
      new AbortController().signal,
      () => undefined,
    );
    expect(result.failed).toEqual(['FEN04-00001']);
    expect(result.stoppedBy).toBeNull();
    expect(Object.keys(result.entries)).toEqual(['2']);
  });
});

describe('plan preferences', () => {
  it('ignores malformed choices', () => {
    expect(
      normalizePlanPreferences({
        // o ritmo da 2.6.0 não tem equivalente
        pace: 'light',
        load: 1,
        postponed: {
          '1': { period: '2027.1' },
          '2': { index: 2 },
          '3': { period: '27.1' },
          '4': { index: -1 },
        },
      }),
    ).toEqual({
      load: null,
      postponed: { '1': { period: '2027.1' }, '2': { index: 2 } },
    });
    expect(normalizePlanPreferences({ load: 3 }).load).toBe(3);
    expect(normalizePlanPreferences({ load: 2.5 }).load).toBeNull();
  });

  it('changes the load and postponements in one step', async () => {
    const { store } = memoryStore();
    const preferences = new PlanPreferencesStore(store);
    await Promise.all([
      preferences.change('a', current => ({ ...current, load: 2 })),
      preferences.change('a', current => ({
        ...current,
        postponed: { ...current.postponed, '7': { period: '2027.1' } },
      })),
    ]);
    expect(await preferences.read('a')).toEqual({
      load: 2,
      postponed: { '7': { period: '2027.1' } },
    });
  });
});
