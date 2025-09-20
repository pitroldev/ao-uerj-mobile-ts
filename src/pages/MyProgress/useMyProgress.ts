import {useMemo} from 'react';
import {useAppDispatch, useAppSelector} from '@root/store';
import {useQuery} from 'react-query';

import {selectSubjectsAttended} from '@features/SubjectsTaken/reducer';
import {selectCurriculumSubjects} from '@features/CurriculumSubjects/reducer';
import {selectClassGrades, setClassGrades} from '@features/ClassGrades/reducer';
import * as subjectsTakenReducer from '@features/SubjectsTaken/reducer';
import * as curriculumReducer from '@features/CurriculumSubjects/reducer';
import {fetchSubjectsTaken} from '@features/SubjectsTaken/core';
import {fetchCurriculumSubjects} from '@features/CurriculumSubjects/core';
import {fetchClassGrades} from '@features/ClassGrades/core';
import {selectApiConfig} from '@reducers/apiConfig';
import {SUBJECT_TYPE} from '@utils/constants/subjectDictionary';

type Point = {label: string; cra: number};

function isApproved(status: string | undefined) {
  return status === 'APPROVED' || status === 'EXEMPT';
}

function useCraProgression() {
  const {data: taken} = useAppSelector(selectSubjectsAttended);

  return useMemo(() => {
    const perPeriod: Record<string, {sum: number; credits: number}> = {};
    taken.forEach(s => {
      if (
        s.grade != null &&
        s.credits != null &&
        !isNaN(s.grade) &&
        !isNaN(s.credits)
      ) {
        const p = s.period?.slice(-4) || '-';
        const w = Number(s.credits) || 0;
        const g = Number(s.grade) || 0;
        if (!perPeriod[p]) {
          perPeriod[p] = {sum: 0, credits: 0};
        }
        perPeriod[p].sum += g * w;
        perPeriod[p].credits += w;
      }
    });

    const periods = Object.keys(perPeriod).sort();
    const pointsOverTime: Array<Point> = [];
    let accSum = 0;
    let accCredits = 0;

    periods.forEach(p => {
      accSum += perPeriod[p].sum;
      accCredits += perPeriod[p].credits;
      const cra = accCredits > 0 ? accSum / accCredits : 0;
      pointsOverTime.push({label: p, cra: Number(cra.toFixed(2))});
    });

    const currentCRA = pointsOverTime.length
      ? pointsOverTime[pointsOverTime.length - 1].cra
      : 0;

    return {pointsOverTime, currentCRA};
  }, [taken]);
}

export function useMyProgress() {
  const dispatch = useAppDispatch();
  const {data: taken} = useAppSelector(selectSubjectsAttended);
  const {data: curriculum} = useAppSelector(selectCurriculumSubjects);
  useAppSelector(selectClassGrades); // ensure slice is hydrated
  const {cookies} = useAppSelector(selectApiConfig);

  const HOUR_IN_MS = 1000 * 60 * 60;

  // Fetch data via existing features
  const subjectsTakenQuery = useQuery({
    queryKey: ['subjects-taken', cookies],
    queryFn: fetchSubjectsTaken,
    staleTime: 24 * HOUR_IN_MS,
    onSuccess: d => dispatch(subjectsTakenReducer.setState(d)),
  });

  const curriculumQuery = useQuery({
    queryKey: ['curriculum-subjects', cookies],
    queryFn: fetchCurriculumSubjects,
    staleTime: 24 * HOUR_IN_MS,
    onSuccess: d => dispatch(curriculumReducer.setState(d)),
  });

  const gradesQuery = useQuery({
    queryKey: ['class-grades', cookies],
    queryFn: fetchClassGrades,
    staleTime: 24 * HOUR_IN_MS,
    onSuccess: d => dispatch(setClassGrades(d)),
  });

  const {currentCRA, pointsOverTime} = useCraProgression();

  const approvedCount = useMemo(
    () => taken.filter(s => isApproved(s.status)).length,
    [taken, curriculum],
  );

  const byType = useMemo(() => {
    type Key = keyof typeof SUBJECT_TYPE;
    const types: Key[] = ['MANDATORY', 'RESTRICTED', 'DEFINED', 'UNIVERSAL'];

    const totals: Record<Key, number> = {
      MANDATORY: 0,
      RESTRICTED: 0,
      DEFINED: 0,
      UNIVERSAL: 0,
    };
    const completed: Record<Key, number> = {
      MANDATORY: 0,
      RESTRICTED: 0,
      DEFINED: 0,
      UNIVERSAL: 0,
    };
    const totalCredits: Record<Key, number> = {
      MANDATORY: 0,
      RESTRICTED: 0,
      DEFINED: 0,
      UNIVERSAL: 0,
    };
    const completedCredits: Record<Key, number> = {
      MANDATORY: 0,
      RESTRICTED: 0,
      DEFINED: 0,
      UNIVERSAL: 0,
    };

    // Curriculum totals by type
    curriculum.forEach(c => {
      const t = (c.type as Key) || 'MANDATORY';
      if (t in totals) {
        totals[t] += 1;
      }
      if (t in totalCredits) {
        totalCredits[t] += Number(c.credits || 0);
      }
    });

    // Completed by type from taken subjects
    taken.forEach(s => {
      const t = (s.type as Key) || 'MANDATORY';
      if (t in completed && isApproved(s.status)) {
        completed[t] += 1;
        completedCredits[t] += Number(s.credits || 0);
      }
    });

    const remaining: Record<Key, number> = {
      MANDATORY: Math.max(totals.MANDATORY - completed.MANDATORY, 0),
      RESTRICTED: Math.max(totals.RESTRICTED - completed.RESTRICTED, 0),
      DEFINED: Math.max(totals.DEFINED - completed.DEFINED, 0),
      UNIVERSAL: Math.max(totals.UNIVERSAL - completed.UNIVERSAL, 0),
    };

    const percent = (comp: number, tot: number) =>
      tot > 0 ? Math.round((comp / tot) * 100) : 0;

    return {
      order: types,
      totals,
      completed,
      remaining,
      percent: {
        MANDATORY: percent(completed.MANDATORY, totals.MANDATORY),
        RESTRICTED: percent(completed.RESTRICTED, totals.RESTRICTED),
        DEFINED: percent(completed.DEFINED, totals.DEFINED),
        UNIVERSAL: percent(completed.UNIVERSAL, totals.UNIVERSAL),
      },
      totalCredits,
      completedCredits,
    };
  }, [curriculum, taken]);

  const initialLoading =
    subjectsTakenQuery.isLoading ||
    curriculumQuery.isLoading ||
    gradesQuery.isLoading;
  const isEmpty = taken.length === 0 && curriculum.length === 0;

  return {
    initialLoading,
    isEmpty,
    approvedCount,
    currentCRA,
    pointsOverTime,
    byType,
  } as const;
}
