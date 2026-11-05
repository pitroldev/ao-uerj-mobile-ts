import {
  ScheduleImage,
  ScheduleSharingPort,
} from '../ports/ScheduleSharingPort';

export class ShareSchedule {
  constructor(private readonly sharing: ScheduleSharingPort) {}

  /** `message` é a legenda (o link do app, onde ele está numa loja). */
  async execute(
    target: object | null,
    svgUri: string,
    message?: string,
  ): Promise<boolean> {
    const caption = message ? { message } : {};
    let image: ScheduleImage = {
      url: svgUri,
      type: 'image/svg+xml',
      ...caption,
    };
    if (target) {
      try {
        image = {
          url: await this.sharing.capturePng(target),
          type: 'image/png',
          ...caption,
        };
      } catch {
        // SVG remains SVG: relabeling its bytes as PNG produces a corrupt image.
      }
    }
    return this.sharing.share(image);
  }
}
