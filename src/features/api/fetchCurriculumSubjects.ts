import store from '@root/store';
import * as reducer from '@root/reducers/curriculumSubjects';

import {getCurriculumSubjects} from '@services/UerjApi';
import isExpired from '@root/utils/isExpired';

export async function fetchCurriculumSubjects() {
  const {subjectsAttended} = store.getState();
  if (!isExpired(subjectsAttended?.lastUpdatedAt, 12)) {
    return;
  }

  const data = await getCurriculumSubjects();
  store.dispatch(reducer.setState(data));

  return data;
}
