import Share from 'react-native-share';
import { captureRef } from 'react-native-view-shot';
import type { View } from 'react-native';
import type {
  ScheduleImage,
  ScheduleSharingPort,
} from '@root/modules/academics/application/ports/ScheduleSharingPort';

export class NativeScheduleSharing implements ScheduleSharingPort {
  capturePng(target: object): Promise<string> {
    return captureRef(target as View, { format: 'png', quality: 1 });
  }

  async share(image: ScheduleImage): Promise<void> {
    await Share.open({ ...image, failOnCancel: false });
  }
}
