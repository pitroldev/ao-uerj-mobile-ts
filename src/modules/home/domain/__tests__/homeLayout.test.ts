import {
  DEFAULT_HOME_LAYOUT,
  isDefaultLayout,
  moveSection,
  normalizeHomeLayout,
  setSectionVisible,
  visibleSections,
} from '../homeLayout';

describe('a cópia salva do Início', () => {
  it('sem nada salvo (ou estragado), é o Início de sempre', () => {
    expect(normalizeHomeLayout(null)).toEqual(DEFAULT_HOME_LAYOUT);
    expect(normalizeHomeLayout('0.0.0')).toEqual(DEFAULT_HOME_LAYOUT);
    expect(
      normalizeHomeLayout({
        greeting: 'gritar',
        density: 'gigante',
        nextClassMap: 'sim',
        evaluationLimit: 7,
      }),
    ).toEqual(DEFAULT_HOME_LAYOUT);
  });

  it('guarda a ordem do aluno e põe uma seção nova no lugar dela', () => {
    // uma cópia de antes da Companhia agora e do Agora no campus, com Semana
    // antes de Notas
    const layout = normalizeHomeLayout({
      order: ['next-class', 'evaluations', 'week', 'grades', 'antiga'],
      hidden: ['grades', 'grades', 'antiga'],
      greeting: 'date',
      density: 'compact',
      nextClassMap: false,
      evaluationLimit: 5,
    });
    expect(layout).toEqual({
      order: [
        'next-class',
        'companion',
        'campus',
        'evaluations',
        'week',
        'grades',
      ],
      hidden: ['grades'],
      greeting: 'date',
      density: 'compact',
      nextClassMap: false,
      evaluationLimit: 5,
    });
  });
});

describe('arrumar as seções', () => {
  it('sobe e desce entre as que estão na lista, sem passar das pontas', () => {
    const up = moveSection(DEFAULT_HOME_LAYOUT, 'week', -1);
    expect(up.order).toEqual([
      'next-class',
      'companion',
      'campus',
      'evaluations',
      'week',
      'grades',
    ]);
    expect(moveSection(up, 'next-class', -1)).toBe(up);
    expect(moveSection(up, 'grades', 1)).toBe(up);
  });

  it('pula a seção que o aparelho não tem, que fica onde estava', () => {
    const available = ['next-class', 'evaluations', 'grades', 'week'] as const;
    const moved = moveSection(
      DEFAULT_HOME_LAYOUT,
      'evaluations',
      -1,
      available,
    );
    expect(moved.order).toEqual([
      'evaluations',
      'companion',
      'campus',
      'next-class',
      'grades',
      'week',
    ]);
    expect(visibleSections(moved, available)).toEqual([
      'evaluations',
      'next-class',
      'grades',
      'week',
    ]);
  });

  it('uma cópia da 2.13, já com a Companhia, ganha o Agora no campus logo depois dela', () => {
    const layout = normalizeHomeLayout({
      order: ['week', 'companion', 'next-class', 'evaluations', 'grades'],
      hidden: ['companion'],
    });
    expect(layout.order).toEqual([
      'week',
      'companion',
      'campus',
      'next-class',
      'evaluations',
      'grades',
    ]);
    expect(visibleSections(layout)).toContain('campus');
  });

  it('esconde e mostra, e sabe quando voltou ao padrão', () => {
    const hidden = setSectionVisible(DEFAULT_HOME_LAYOUT, 'grades', false);
    expect(visibleSections(hidden)).not.toContain('grades');
    expect(isDefaultLayout(hidden)).toBe(false);
    const shown = setSectionVisible(hidden, 'grades', true);
    expect(visibleSections(shown)).toContain('grades');
    expect(isDefaultLayout(shown)).toBe(true);
  });
});
