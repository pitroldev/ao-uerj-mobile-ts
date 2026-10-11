import { useCallback, useEffect, useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  useAppServices,
  useIdentity,
} from '@root/app/providers/AppServicesProvider';
import { GenerateSchedules } from '../application/GenerateSchedules';
import { ScheduleCreationParams } from '../domain/models';
import { AppError } from '@root/shared/errors/AppError';

/** Generation runs only in response to an explicit action, never window focus. */
export function useGenerateSchedules() {
  const { scheduleGenerator, identity } = useAppServices();
  const { account } = useIdentity();
  const pending = useRef<AbortController | null>(null);
  const scope = account?.scope;
  useEffect(
    () => () => {
      pending.current?.abort();
    },
    [scope],
  );
  const mutation = useMutation({
    mutationKey: ['planning', scope, 'generation'],
    retry: false,
    mutationFn: async (form: ScheduleCreationParams) => {
      if (!scope || identity.getSnapshot().account?.scope !== scope)
        throw new AppError('NOT_LOGGED_IN');
      pending.current?.abort();
      const controller = new AbortController();
      pending.current = controller;
      const schedules = await new GenerateSchedules(scheduleGenerator).execute(
        form,
        { signal: controller.signal },
      );
      if (
        controller.signal.aborted ||
        identity.getSnapshot().account?.scope !== scope
      )
        throw new AppError('CANCELLED');
      return schedules;
    },
  });
  const cancel = useCallback(() => pending.current?.abort(), []);
  return { ...mutation, cancel };
}
