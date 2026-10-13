import Share from 'react-native-share';
import { captureRef } from 'react-native-view-shot';
import type { ViewInstance } from 'react-native';
import type {
  ScheduleImage,
  ScheduleSharingPort,
} from '@root/modules/academics/application/ports/ScheduleSharingPort';

export class NativeScheduleSharing implements ScheduleSharingPort {
  capturePng(target: object): Promise<string> {
    return captureRef(target as ViewInstance, { format: 'png', quality: 1 });
  }

  async share(image: ScheduleImage): Promise<boolean> {
    const result = await Share.open({ ...image, failOnCancel: false });
    return result.success === true;
  }
}
