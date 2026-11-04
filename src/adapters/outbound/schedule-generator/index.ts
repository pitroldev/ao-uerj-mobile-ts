import axios from 'axios';
import { ScheduleGeneratorPort } from '@root/modules/planning/application/ports';
import { AppError } from '@root/shared/errors/AppError';
import type { StudentSession } from '@root/modules/trust/application/StudentSession';
import { banOf } from '../private-api/studentSession';
import { toGeneratorPayload } from './mappers';
import { parseGeneratorResponse } from './response';

export interface GeneratorTransport {
  post(
    path: string,
    body: unknown,
    options: { signal?: AbortSignal; headers?: Record<string, string> },
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

/** A sessão de aluno do gerador: opcional, porque o gerador também serve sem ela. */
type Session = Pick<
  StudentSession,
  'supported' | 'token' | 'invalidate' | 'banned'
>;

/** O 401 de uma sessão que o servidor não aceita mais. */
const sessionRefused = (error: unknown) =>
  axios.isAxiosError(error) &&
  error.response?.status === 401 &&
  (error.response.data as { error?: unknown } | undefined)?.error ===
    'invalid_session';

/**
 * O gerador de grades. Com a sessão de aluno, cada geração conta para o
 * aluno; sem como entrar agora (iPhone, sem rede para a atestação), segue sem
 * ela, como nos apps antigos. Banido, não gera, como no servidor.
 */
export function createScheduleGeneratorAdapter(
  transport: GeneratorTransport = createGeneratorTransport(),
  session: Session | null = null,
): ScheduleGeneratorPort {
  const token = async () => {
    if (!session?.supported) return null;
    try {
      return await session.token();
    } catch (error) {
      if (error instanceof AppError && error.code === 'STUDENT_BANNED')
        throw error;
      return null;
    }
  };
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
        const body = {
          ...payload,
          preferences: {
            ...payload.preferences,
            max_subject_amount: maximum,
          },
        };
        const send = (current: string | null) =>
          transport.post('/generate', body, {
            signal: options?.signal,
            ...(current
              ? { headers: { Authorization: `Student ${current}` } }
              : {}),
          });
        const current = await token();
        let response: { data: unknown };
        try {
          response = await send(current);
        } catch (error) {
          // a sessão venceu: esquece e gera sem ela (a próxima entra de novo)
          if (!current || !sessionRefused(error) || !session) throw error;
          await session.invalidate(current);
          response = await send(null);
        }
        if (options?.signal?.aborted) throw new AppError('CANCELLED');
        return parseGeneratorResponse(response.data);
      } catch (error) {
        if (error instanceof AppError) throw error;
        const ban = axios.isAxiosError(error)
          ? banOf(error.response?.data)
          : null;
        if (ban && session) throw session.banned(ban);
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
