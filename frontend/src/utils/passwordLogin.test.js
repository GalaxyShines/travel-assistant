import test from 'node:test';
import assert from 'node:assert/strict';

test('password login parameter is read from the current URL', async () => {
  const module = await import('./passwordLogin.js').catch(() => ({}));

  assert.equal(typeof module.getPasswordLoginParam, 'function');
  assert.equal(
    module.getPasswordLoginParam(new URL('https://example.test/travel-helper/?pwd=Qwerty%40123!')),
    'Qwerty@123!'
  );
});

test('missing password login parameter does not request auto login', async () => {
  const { getPasswordLoginParam } = await import('./passwordLogin.js');

  assert.equal(getPasswordLoginParam(new URL('https://example.test/travel-helper/?trip=1')), '');
});

test('password login parameter can be removed without changing the route', async () => {
  const { removePasswordLoginParam } = await import('./passwordLogin.js');
  const calls = [];
  const history = {
    state: { from: 'test' },
    replaceState: (...args) => calls.push(args)
  };

  const removed = removePasswordLoginParam(
    new URL('https://example.test/travel-helper/?pwd=secret&trip=1#places'),
    history
  );

  assert.equal(removed, true);
  assert.deepEqual(calls, [[{ from: 'test' }, '', '/travel-helper/?trip=1#places']]);
});

test('password login parameter triggers login and is removed after success', async () => {
  const { attemptPasswordParamLogin } = await import('./passwordLogin.js');
  const loginCalls = [];
  const historyCalls = [];

  const result = await attemptPasswordParamLogin({
    location: new URL('https://example.test/travel-helper/?pwd=secret&trip=1'),
    history: {
      state: null,
      replaceState: (...args) => historyCalls.push(args)
    },
    login: async (password) => {
      loginCalls.push(password);
    }
  });

  assert.deepEqual(result, { attempted: true });
  assert.deepEqual(loginCalls, ['secret']);
  assert.deepEqual(historyCalls, [[null, '', '/travel-helper/?trip=1']]);
});

test('missing password login parameter skips automatic login', async () => {
  const { attemptPasswordParamLogin } = await import('./passwordLogin.js');
  let loginCalled = false;

  const result = await attemptPasswordParamLogin({
    location: new URL('https://example.test/travel-helper/'),
    history: {
      state: null,
      replaceState: () => {
        throw new Error('replaceState should not be called');
      }
    },
    login: async () => {
      loginCalled = true;
    }
  });

  assert.deepEqual(result, { attempted: false });
  assert.equal(loginCalled, false);
});
