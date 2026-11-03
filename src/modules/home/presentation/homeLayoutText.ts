import type { IconName } from '@components/ui/Icon/glyphs';
import type {
  EvaluationLimit,
  GreetingStyle,
  HomeDensity,
  HomeSectionId,
} from '../domain/homeLayout';

export const SECTION_TEXT: Readonly<
  Record<HomeSectionId, { title: string; description: string; icon: IconName }>
> = {
  'next-class': {
    title: 'Próxima aula',
    description: 'O horário, a sala e o convite de lembretes',
    icon: 'schedule',
  },
  companion: {
    title: 'Companhia agora',
    description: 'Mesas e grupos para voltar, só na hora certa',
    icon: 'groups',
  },
  evaluations: {
    title: 'Próximas avaliações',
    description: 'As provas e trabalhos que você anotou',
    icon: 'event_upcoming',
  },
  grades: {
    title: 'Notas',
    description: 'O quadro de notas do período',
    icon: 'history_edu',
  },
  week: {
    title: 'Semana',
    description: 'As aulas dia a dia, com as faltas',
    icon: 'view_week',
  },
};

export const GREETING_TEXT: Readonly<Record<GreetingStyle, string>> = {
  full: 'Olá e a data',
  date: 'Só a data',
  none: 'Nenhuma',
};

export const DENSITY_TEXT: Readonly<Record<HomeDensity, string>> = {
  comfortable: 'Normal',
  compact: 'Compacto',
};

/** "1 avaliação", "3 avaliações". */
export const limitText = (limit: EvaluationLimit) =>
  `${limit} ${limit === 1 ? 'avaliação' : 'avaliações'}`;
