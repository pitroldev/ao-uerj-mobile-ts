import axios from 'axios';
import { AppError } from '@root/shared/errors/AppError';
import type {
  PortalReturnServerPort,
  PushRegistrationServerPort,
} from '@root/modules/notifications/application/ports';
// O contrato do servidor (server/); só tipos, apagados no bundle.
import type {
  PortalPushStatusResponse,
  PortalReturnAlertStatusResponse,
  RegisterPortalPushRequest,
  RequestPortalReturnAlertRequest,
} from '../../../../server/src/adapters/inbound/http/contract';
import type { PrivateApiHttpClient } from './index';

const broken = () => new AppError('SERVICE_UNAVAILABLE');

function flags(value: unknown, ...names: string[]): Record<string, boolean> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw broken();
  const data = value as Record<string, unknown>;
  return Object.fromEntries(
    names.map(name => {
      if (typeof data[name] !== 'boolean') throw broken();
      return [name, data[name]];
    }),
  );
}

/** Rede fora, `AppError('NETWORK')`; qualquer recusa (`push_unavailable`), `SERVICE_UNAVAILABLE`. */
async function request<T>(execute: () => Promise<T>): Promise<T> {
  try {
    return await execute();
  } catch (error) {
    if (error instanceof AppError) throw error;
    if (axios.isAxiosError(error)) {
      if (!error.response) throw new AppError('NETWORK');
      if (error.response.status === 429) throw new AppError('RATE_LIMITED');
    }
    throw broken();
  }
}

/**
 * "Avisar quando voltar" no iPhone, com a sessão de aluno: o servidor avisa
 * por push quando vê o portal de volta.
 */
export function createPortalReturnServer(
  student: PrivateApiHttpClient,
): PortalReturnServerPort {
  const path = '/v2/portal/return-alert';
  return {
    status: () =>
      request(async () => {
        const { data } = await student.get(path);
        const body = flags(data, 'available', 'requested') as Pick<
          PortalReturnAlertStatusResponse,
          'available' | 'requested'
        >;
        return { available: body.available, requested: body.requested };
      }),
    request: token =>
      request(async () => {
        await student.post(path, {
          platform: 'ios',
          token,
        } satisfies RequestPortalReturnAlertRequest);
      }),
    cancel: () =>
      request(async () => {
        await student.post(`${path}/cancel`, {});
      }),
  };
}

/**
 * O registro do iPhone para o cutucão da verificação no portal (um push
 * silencioso a cada 4 horas), com a sessão de aluno.
 */
export function createPortalPushServer(
  student: PrivateApiHttpClient,
): PushRegistrationServerPort {
  const path = '/v2/portal/push';
  return {
    status: () =>
      request(async () => {
        const { data } = await student.get(path);
        const body = flags(data, 'available', 'registered') as Pick<
          PortalPushStatusResponse,
          'available' | 'registered'
        >;
        return { available: body.available, registered: body.registered };
      }),
    register: token =>
      request(async () => {
        await student.post(path, {
          platform: 'ios',
          token,
        } satisfies RegisterPortalPushRequest);
      }),
    unregister: () =>
      request(async () => {
        await student.post(`${path}/cancel`, {});
      }),
  };
}
