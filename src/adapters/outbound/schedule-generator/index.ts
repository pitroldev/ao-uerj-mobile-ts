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

const GENERATOR_URL = 'https://pitrol.dev/schedules';

/** O cliente HTTP do app; o teste de contrato o aponta para um servidor local. */
export function createGeneratorTransport(
  baseURL = GENERATOR_URL,
): GeneratorTransport {
  return axios.create({
    baseURL,
    timeout: 60000,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

export function createScheduleGeneratorAdapter(
  transport: GeneratorTransport = createGeneratorTransport(),
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

        // The server (server/) enumerates every size from the minimum up and
        // ranks subject count first: an empty answer is final, one POST.
        const payload = toGeneratorPayload(request);
        const response = await transport.post(
          '/generate',
          {
            ...payload,
            preferences: {
              ...payload.preferences,
              max_subject_amount: maximum,
            },
          },
          { signal: options?.signal },
        );
        if (options?.signal?.aborted) throw new AppError('CANCELLED');
        return parseGeneratorResponse(response.data);
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
