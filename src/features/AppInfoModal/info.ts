import type { IconName } from '@components/ui';

export const APP_INFO = [
  {
    title: 'Gerador de Grade',
    icon: 'edit_calendar',
    description:
      'Crie grades de horários personalizadas com base nas suas preferências e disponibilidade.',
  },
  {
    title: 'Meu Progresso',
    icon: 'monitoring',
    description:
      'Acompanhe seu desempenho acadêmico com estatísticas detalhadas, evolução do CR e progresso no currículo.',
  },
  {
    title: 'Mural de mensagens',
    icon: 'forum',
    description:
      'Canal de comunicação exclusivo entre alunos da mesma turma com total privacidade.',
  },
] as {
  title: string;
  /** Ícone da linha (padrão "star"). */
  icon?: IconName;
  isNew?: boolean;
  description: string;
}[];
