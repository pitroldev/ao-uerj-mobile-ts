export type ScheduleImage = {
  url: string;
  type: 'image/png' | 'image/svg+xml';
};

export interface ScheduleSharingPort {
  capturePng(target: object): Promise<string>;
  share(image: ScheduleImage): Promise<void>;
}
