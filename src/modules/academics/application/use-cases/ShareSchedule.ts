import {
  ScheduleImage,
  ScheduleSharingPort,
} from '../ports/ScheduleSharingPort';

export class ShareSchedule {
  constructor(private readonly sharing: ScheduleSharingPort) {}

  async execute(target: object | null, svgUri: string): Promise<void> {
    let image: ScheduleImage = { url: svgUri, type: 'image/svg+xml' };
    if (target) {
      try {
        image = {
          url: await this.sharing.capturePng(target),
          type: 'image/png',
        };
      } catch {
        // SVG remains SVG: relabeling its bytes as PNG produces a corrupt image.
      }
    }
    await this.sharing.share(image);
  }
}
