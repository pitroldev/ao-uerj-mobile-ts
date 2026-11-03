import type { IconName } from '@components/ui';

/** Preferência da conta com a última versão cuja folha foi vista. */
export const APP_INFO_VERSION_KEY = 'app-info-version';

export const APP_INFO = [
  {
    title: 'Início do seu jeito',
    icon: 'tune',
    isNew: true,
    description:
      'Em "Personalizar o Início", escolha as seções, a ordem, a saudação, a densidade e quantas avaliações aparecem.',
  },
  {
    title: 'Companhia agora',
    icon: 'groups',
    isNew: true,
    needsCompanion: true,
    description:
      'Uma mesa aberta no almoço ou a volta em grupo depois da última aula da noite, com a janela livre tirada da grade e o encontro dentro do campus. Só o primeiro nome aparece.',
  },
  {
    title: 'Plano até a formatura',
    icon: 'school',
    isNew: true,
    description:
      'As disciplinas que faltam distribuídas pelos próximos períodos, com os pré-requisitos, os gargalos e o prazo máximo da Síntese da Formação.',
  },
  {
    title: 'Quanto preciso na PF',
    icon: 'tune',
    isNew: true,
    description:
      'No quadro de notas, a nota que falta na PF de cada disciplina e a simulação da média final e do CR aproximado.',
  },
  {
    title: 'Controle de faltas',
    icon: 'event_busy',
    isNew: true,
    description:
      'Marque as faltas na agenda e veja quantas ainda cabem em cada disciplina. As faltas ficam só no aparelho.',
  },
  {
    title: 'Widget e atalhos',
    icon: 'grid_view',
    isNew: true,
    needsLaunches: true,
    description:
      'A próxima aula na tela inicial do celular e atalhos no ícone do app para Próxima aula, Notas, Mapa e Documentos.',
  },
  {
    title: 'Notificações',
    icon: 'notifications',
    isNew: true,
    needsNotifications: true,
    description:
      'Lembrete antes de cada aula e avisos de nota nova, RID, resultado da inscrição e documento perto de vencer.',
    remindersOnly: 'Lembrete antes de cada aula, com o horário e a sala.',
  },
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
    title: 'Mural de Mensagens',
    icon: 'forum',
    description:
      'Canal de comunicação exclusivo entre alunos da mesma turma com total privacidade.',
  },
] as {
  title: string;
  /** Ícone da linha (padrão "star"). */
  icon?: IconName;
  isNew?: boolean;
  /** Só onde o aparelho tem os avisos (módulo nativo). */
  needsNotifications?: boolean;
  /** Só onde o app abre por fora (widget e atalhos do ícone). */
  needsLaunches?: boolean;
  /** Só onde há a Companhia agora (tokens anônimos de aluno). */
  needsCompanion?: boolean;
  description: string;
  /** A descrição sem a verificação no portal (no iPhone, só os lembretes). */
  remindersOnly?: string;
}[];
