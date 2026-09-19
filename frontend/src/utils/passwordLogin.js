const PASSWORD_LOGIN_PARAM = 'pwd';

export function getPasswordLoginParam(location) {
  if (!location) {
    return '';
  }

  const url = location instanceof URL ? location : new URL(location.href);
  return url.searchParams.get(PASSWORD_LOGIN_PARAM) || '';
}

export function removePasswordLoginParam(location, history) {
  const url = location instanceof URL ? new URL(location.href) : new URL(location.href);

  if (!url.searchParams.has(PASSWORD_LOGIN_PARAM)) {
    return false;
  }

  url.searchParams.delete(PASSWORD_LOGIN_PARAM);
  const nextUrl = `${url.pathname}${url.search}${url.hash}`;
  history.replaceState(history.state, '', nextUrl);
  return true;
}

export async function attemptPasswordParamLogin({ location, history, login }) {
  const password = getPasswordLoginParam(location);

  if (!password) {
    return { attempted: false };
  }

  await login(password);
  removePasswordLoginParam(location, history);
  return { attempted: true };
}
