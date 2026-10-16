import axios from 'axios';
import { ScheduleGeneratorPort } from '@root/modules/planning/application/ports';
import { AppError } from '@root/shared/errors/AppError';
import { toGeneratorPayload } from './mappers';
import { parseGeneratorResponse } from './response';

export interface GeneratorTransport {
  post(
    path: string,
    body: unknown,
    options: { signal?: AbortSignal },
  ): Promise<{ data: unknown }>;
}

export function createScheduleGeneratorAdapter(
  transport: GeneratorTransport = axios.create({
    baseURL: 'https://pitrol.dev/schedules',
    timeout: 60000,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  }),
): ScheduleGeneratorPort {
  return {
    async generate(request, options) {
      try {
        if (options?.signal?.aborted) throw new AppError('CANCELLED');
        const maximum = Math.min(
          request.preferences.maximumSubjects,
          new Set(request.classes.map(group => group.subject_id)).size,
        );
        const minimum = request.preferences.minimumSubjects;
        if (maximum < minimum) return [];

        // Older server versions enumerate sizes >= 3 plus the exact maximum.
        // They rank subject count first. Probe their omitted sizes only
        // after an empty result; this preserves ranking with at most 3 POSTs.
        const candidateMaximums = [maximum, 2, 1].filter(
          (amount, index, values) =>
            amount >= minimum &&
            amount <= maximum &&
            values.indexOf(amount) === index,
        );
        const payload = toGeneratorPayload(request);
        for (const candidateMaximum of candidateMaximums) {
          if (options?.signal?.aborted) throw new AppError('CANCELLED');
          const response = await transport.post(
            '/generate',
            {
              ...payload,
              preferences: {
                ...payload.preferences,
                max_subject_amount: candidateMaximum,
              },
            },
            { signal: options?.signal },
          );
          if (options?.signal?.aborted) throw new AppError('CANCELLED');
          const schedules = parseGeneratorResponse(response.data);
          if (schedules.length) return schedules;
        }
        return [];
      } catch (error) {
        if (error instanceof AppError) throw error;
        if (options?.signal?.aborted || axios.isCancel(error))
          throw new AppError('CANCELLED');
        if (axios.isAxiosError(error) && error.response?.status === 429)
          throw new AppError('RATE_LIMITED');
        if (axios.isAxiosError(error) && error.response)
          throw new AppError('SERVICE_UNAVAILABLE');
        throw new AppError('NETWORK');
      }
    },
  };
}
