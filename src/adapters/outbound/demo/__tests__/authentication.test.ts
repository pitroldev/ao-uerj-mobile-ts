import { DEMO_CREDENTIALS } from '../account';
import { createDemoClock } from '../clock';
import { createDemoAuthentication } from '../ports/authentication';

function auth(now = new Date(2026, 7, 1, 9, 0)) {
  return createDemoAuthentication(createDemoClock(() => now.getTime(), 0));
}

describe('demo authentication', () => {
  it('signs in with the public credentials', async () => {
    await expect(auth().signIn(DEMO_CREDENTIALS)).resolves.toEqual({
      matricula: '123456',
      name: 'Alex Demonstração',
      period: '2026.2',
      demo: true,
    });
  });

  it('echoes the matricula as typed, also on refresh', async () => {
    const port = auth(new Date(2027, 2, 15));
    await expect(
      port.signIn({ matricula: ' 123456 ', password: 'aouerj-demo' }),
    ).resolves.toMatchObject({ matricula: ' 123456 ', period: '2027.1' });
    await expect(port.refresh()).resolves.toMatchObject({
      matricula: ' 123456 ',
      demo: true,
    });
    await expect(port.signOut()).resolves.toBeUndefined();
  });

  it.each([
    { matricula: '123456', password: 'errada' },
    { matricula: '123456', password: 'AOUERJ-DEMO' },
    { matricula: '123456', password: ' aouerj-demo' },
    { matricula: '1234567', password: 'aouerj-demo' },
    { matricula: '', password: '' },
  ])('rejects %j', async credentials => {
    await expect(auth().signIn(credentials)).rejects.toMatchObject({
      code: 'LOGIN_FAILED',
    });
  });

  it('returns a new profile object every time', async () => {
    const port = auth();
    const first = await port.refresh();
    first.name = 'outro';
    await expect(port.refresh()).resolves.toMatchObject({
      name: 'Alex Demonstração',
    });
  });
});
