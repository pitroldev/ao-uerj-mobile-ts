import store from '@root/store';
import * as reducer from '@root/reducers/curriculumSubjects';

import {getCurriculumSubjects} from '@services/UerjApi';
import isExpired from '@root/utils/isExpired';

export async function fetchCurriculumSubjects() {
  const {curriculumSubjects} = store.getState();
  const isEmpty = curriculumSubjects.data.length === 0;
  if (!isExpired(curriculumSubjects?.lastUpdatedAt, 12) && !isEmpty) {
    return;
  }

  const data = await getCurriculumSubjects();
  store.dispatch(reducer.setState(data));

  return data;
}
