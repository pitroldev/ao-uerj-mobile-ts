import type { IconName } from '@components/ui';

/** Preferência da conta com a última versão cuja folha foi vista. */
export const APP_INFO_VERSION_KEY = 'app-info-version';

export const APP_INFO = [
  {
    title: 'Agora no campus',
    icon: 'campaign',
    isNew: true,
    // como a Companhia, depende da sessão de aluno (Play ou App Attest)
    needsCompanion: true,
    description:
      'Elevador parado, fila do bandejão, falta de luz ou Wi-Fi fora: quem está no lugar avisa em dois toques, e quem vai passar por lá confirma ou diz que acabou. O app pergunta "ainda está lá?" pelo caminho da sua próxima aula.',
  },
  {
    title: 'Companhia agora',
    icon: 'groups',
    isNew: true,
    needsCompanion: true,
    description:
      'Uma mesa para almoçar junto ou um grupo para voltar depois da última aula, nos horários livres da sua grade e com o encontro dentro do campus. Só o primeiro nome aparece.',
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
      'Marque as disciplinas, do seu curso ou universais, e quando não pode ter aula: o app monta as grades, guarda o almoço e deixa mandar a grade para a turma.',
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
      'Recados entre os alunos da mesma turma. Só entra quem é aluno da UERJ.',
  },
] as {
  title: string;
  /** Ícone da linha (padrão "star"). */
  icon?: IconName;
  isNew?: boolean;
  /** Só onde o aparelho tem os avisos (módulo nativo). */
  needsNotifications?: boolean;
  /** Só onde há a Companhia agora (o app entra como aluno). */
  needsCompanion?: boolean;
  description: string;
  /** A descrição sem a verificação no portal (no iPhone, só os lembretes). */
  remindersOnly?: string;
}[];
