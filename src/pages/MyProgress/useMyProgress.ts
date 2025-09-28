import { useMemo, useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '@root/store';
import { useQuery } from '@tanstack/react-query';

import { selectApiConfig } from '@reducers/apiConfig';

import { SUBJECT_TYPE } from '@utils/constants/subjectDictionary';
import { useElectiveCreditsConfig } from '@hooks/useElectiveCreditsConfig';

import { fetchSubjectsTaken } from '@features/SubjectsTaken/core';
import { fetchCurriculumSubjects } from '@features/CurriculumSubjects/core';
import { selectSubjectsAttended } from '@features/SubjectsTaken/reducer';
import * as subjectsTakenReducer from '@features/SubjectsTaken/reducer';
import * as curriculumReducer from '@features/CurriculumSubjects/reducer';
import { selectCurriculumSubjects } from '@features/CurriculumSubjects/reducer';

type Point = { label: string; cra: number };

function isApproved(status: string | undefined) {
  return status === 'APPROVED' || status === 'EXEMPT';
}

function useCraProgression() {
  const { data: taken } = useAppSelector(selectSubjectsAttended);

  return useMemo(() => {
    const perPeriod: Record<string, { sum: number; credits: number }> = {};
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
          perPeriod[p] = { sum: 0, credits: 0 };
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
      pointsOverTime.push({ label: p, cra: Number(cra.toFixed(2)) });
    });

    const currentCRA = pointsOverTime.length
      ? pointsOverTime[pointsOverTime.length - 1].cra
      : 0;

    return { pointsOverTime, currentCRA };
  }, [taken]);
}

export function useMyProgress() {
  const dispatch = useAppDispatch();
  const { data: taken } = useAppSelector(selectSubjectsAttended);
  const { data: curriculum } = useAppSelector(selectCurriculumSubjects);
  const { cookies } = useAppSelector(selectApiConfig);

  const electiveCreditsHook = useElectiveCreditsConfig();

  const HOUR_IN_MS = 1000 * 60 * 60;

  // Fetch data via existing features
  const subjectsTakenQuery = useQuery({
    queryKey: ['subjects-taken', cookies],
    queryFn: fetchSubjectsTaken,
    staleTime: 24 * HOUR_IN_MS,
  });

  useEffect(() => {
    if (subjectsTakenQuery.data) {
      dispatch(subjectsTakenReducer.setState(subjectsTakenQuery.data));
    }
  }, [subjectsTakenQuery.data, dispatch]);

  const curriculumQuery = useQuery({
    queryKey: ['curriculum-subjects', cookies],
    queryFn: fetchCurriculumSubjects,
    staleTime: 24 * HOUR_IN_MS,
  });

  useEffect(() => {
    if (curriculumQuery.data) {
      dispatch(curriculumReducer.setState(curriculumQuery.data));
    }
  }, [curriculumQuery.data, dispatch]);

  const { currentCRA, pointsOverTime } = useCraProgression();

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

    // Calculate required credits for electives based on user config
    const requiredCredits: Record<Key, number | null> = {
      MANDATORY: totals.MANDATORY, // Keep existing logic for mandatory
      RESTRICTED:
        electiveCreditsHook.config.RESTRICTED > 0
          ? electiveCreditsHook.config.RESTRICTED
          : null,
      DEFINED:
        electiveCreditsHook.config.DEFINED > 0
          ? electiveCreditsHook.config.DEFINED
          : null,
      UNIVERSAL:
        electiveCreditsHook.config.UNIVERSAL > 0
          ? electiveCreditsHook.config.UNIVERSAL
          : null,
    };

    const percent = (comp: number, tot: number) =>
      tot > 0 ? Math.round((comp / tot) * 100) : 0;

    // For electives with configured required credits, calculate percentage based on credits
    const getPercentage = (type: Key) => {
      if (type === 'MANDATORY') {
        return percent(completed[type], totals[type]);
      }

      const required = requiredCredits[type];
      if (required && required > 0) {
        return percent(completedCredits[type], required);
      }

      return 0;
    };

    return {
      order: types,
      totals,
      completed,
      remaining,
      requiredCredits,
      percent: {
        MANDATORY: getPercentage('MANDATORY'),
        RESTRICTED: getPercentage('RESTRICTED'),
        DEFINED: getPercentage('DEFINED'),
        UNIVERSAL: getPercentage('UNIVERSAL'),
      },
      totalCredits,
      completedCredits,
    };
  }, [curriculum, taken, electiveCreditsHook.config]);

  const initialLoading =
    subjectsTakenQuery.isLoading || curriculumQuery.isLoading;
  const isEmpty = taken.length === 0 && curriculum.length === 0;

  return {
    initialLoading,
    isEmpty,
    approvedCount,
    currentCRA,
    pointsOverTime,
    byType,
    electiveCreditsHook,
  } as const;
}
