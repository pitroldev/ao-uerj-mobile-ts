import { AppError } from '@root/shared/errors/AppError';
import { observePortalTransport } from '../observedTransport';
import type { PortalTransport } from '../contracts';

function setup(outcome: () => Promise<{ status: number; body: string }>) {
  const transport: PortalTransport = {
    request: jest.fn(outcome),
    cancelAndDrain: jest.fn(async () => undefined),
  };
  const monitor = {
    guard: jest.fn(),
    answered: jest.fn(),
    failed: jest.fn(),
  };
  let now = 1000;
  const observed = observePortalTransport(transport, monitor, () => {
    now += 250;
    return now;
  });
  return { transport, monitor, observed };
}

it('reports each answer with its duration', async () => {
  const { monitor, observed } = setup(async () => ({ status: 503, body: '' }));
  await expect(observed.request({ path: '/' })).resolves.toEqual({
    status: 503,
    body: '',
  });
  expect(monitor.guard).toHaveBeenCalledTimes(1);
  expect(monitor.answered).toHaveBeenCalledWith(503, 250);
});

it('reports network failures and lets cancellations pass', async () => {
  const network = setup(async () => {
    throw new AppError('NETWORK');
  });
  await expect(network.observed.request({ path: '/' })).rejects.toThrow(
    'NETWORK',
  );
  expect(network.monitor.failed).toHaveBeenCalledWith('network');

  const cancelled = setup(async () => {
    throw new AppError('CANCELLED');
  });
  await expect(cancelled.observed.request({ path: '/' })).rejects.toThrow(
    'CANCELLED',
  );
  expect(cancelled.monitor.failed).not.toHaveBeenCalled();
});

it('does not reach the portal while the monitor holds the reads', async () => {
  const { transport, monitor, observed } = setup(async () => ({
    status: 200,
    body: '',
  }));
  monitor.guard.mockImplementation(() => {
    throw new AppError('SERVICE_UNAVAILABLE');
  });
  await expect(observed.request({ path: '/' })).rejects.toThrow(
    'SERVICE_UNAVAILABLE',
  );
  expect(transport.request).not.toHaveBeenCalled();
  await observed.cancelAndDrain();
  expect(transport.cancelAndDrain).toHaveBeenCalledTimes(1);
});
