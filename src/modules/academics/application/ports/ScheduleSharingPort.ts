export type ScheduleImage = {
  url: string;
  type: 'image/png' | 'image/svg+xml';
};

export interface ScheduleSharingPort {
  capturePng(target: object): Promise<string>;
  /** `true` quando o aluno escolheu um destino (não cancelou). */
  share(image: ScheduleImage): Promise<boolean>;
}
