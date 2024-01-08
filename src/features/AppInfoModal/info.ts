export const APP_INFO = [
  {
    title: 'Mudanças no App',
    description:
      'Devido a alterações no site oficial do AO, algumas funcionalidades foram desativadas e/ou remodeladas.',
  },
  {
    title: 'Gerador de Grade (beta)',
    description: 'Gere suas grades de horários de forma rápida e fácil.',
  },
  {
    title: 'Mural de mensagens',
    description:
      'Compartilhe mensagens com seus amigos e colegas de curso de forma segura e fácil.',
  },
  {
    title: 'Pesquisa de disciplina',
    description:
      'Pesquise disciplinas pelo código e tenha um histórico de suas pesquisas.',
  },
] as {
  title: string;
  isNew?: boolean;
  description: string;
}[];
