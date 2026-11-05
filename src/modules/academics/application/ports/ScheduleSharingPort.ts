export type ScheduleImage = {
  url: string;
  type: 'image/png' | 'image/svg+xml';
  /** A legenda que vai junto (no WhatsApp, o texto embaixo da imagem). */
  message?: string;
};

export interface ScheduleSharingPort {
  capturePng(target: object): Promise<string>;
  /** `true` quando o aluno escolheu um destino (não cancelou). */
  share(image: ScheduleImage): Promise<boolean>;
}
