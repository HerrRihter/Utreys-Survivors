const assert = require('node:assert/strict');
const {
  authErrorText,
  loginEmail,
  loginError,
  loginKey,
  passwordError,
} = require('../src/services/login.js');
const { createAccount } = require('../src/services/auth.js');

// Logins: Cyrillic or Latin, one key per login whatever the case or «ё», hex service address.
assert.equal(loginError('Вася'), null);
assert.equal(loginError('vasya_2'), null);
assert.equal(loginError('Алёна-1'), null);
assert.equal(loginError('Вaся'), 'Не смешивай кириллицу и латиницу', 'Latin «a» in Cyrillic');
assert.match(loginError('ab'), /от 3 до 16/);
assert.match(loginError('абвгдеёжзийклмнопр'), /от 3 до 16/);
assert.equal(loginError('абвгдеёжзийклмно'), null, '16 Cyrillic letters fit');
assert.match(loginError('va sya'), /буквы, цифры/);
assert.match(loginError('vasya@'), /буквы, цифры/);
assert.equal(loginKey('  АЛЁНА '), 'алена');
assert.equal(loginKey('Алена'), loginKey('алёна'));
assert.equal(loginEmail('Алёна', 'p.firebaseapp.com'), loginEmail('АЛЕНА', 'p.firebaseapp.com'));
assert.equal(loginEmail('Vasya', 'p.firebaseapp.com'), '7661737961@p.firebaseapp.com');
const longest = loginEmail('абвгдеёжзийклмно', 'p.firebaseapp.com');
assert.equal(longest.split('@')[0].length, 64, 'the address fits the 64-character local part');
assert.match(longest, /^[0-9a-f]+@/);
assert.match(passwordError('12345'), /не короче 6/);
assert.equal(passwordError('123456', '123457'), 'Пароли не совпадают');
assert.equal(passwordError('123456', '123456'), null);
assert.equal(authErrorText({ code: 'auth/email-already-in-use' }), 'Логин занят');
assert.equal(authErrorText({ code: 'auth/invalid-credential' }), 'Неверный логин или пароль');
assert.equal(authErrorText({ code: 'whatever' }), 'Не получилось, попробуй ещё раз');

// A fake Firebase with the SDK surface auth.js uses: accounts by address, documents by path.
function fakeFirebase({ failProfile = false } = {}) {
  const accounts = new Map(),
    docs = new Map(),
    listeners = new Set();
  let nextUid = 1;
  const auth = { currentUser: null };
  const signInAs = (user) => {
    auth.currentUser = user;
    for (const listener of listeners) listener(user);
  };
  const error = (code) => Object.assign(new Error(code), { code });
  const snapshot = (path) => ({
    exists: () => docs.has(path),
    data: () => docs.get(path),
  });
  const authApi = {
    onAuthStateChanged(_auth, listener) {
      listeners.add(listener);
      queueMicrotask(() => listener(auth.currentUser));
      return () => listeners.delete(listener);
    },
    async createUserWithEmailAndPassword(_auth, email, password) {
      if (accounts.has(email)) throw error('auth/email-already-in-use');
      const user = { uid: 'u' + nextUid++, email };
      accounts.set(email, { user, password });
      signInAs(user);
      return { user };
    },
    async signInWithEmailAndPassword(_auth, email, password) {
      const account = accounts.get(email);
      if (!account || account.password !== password) throw error('auth/invalid-credential');
      signInAs(account.user);
      return { user: account.user };
    },
    async signOut() {
      signInAs(null);
    },
    async deleteUser(user) {
      accounts.delete(user.email);
      signInAs(null);
    },
    EmailAuthProvider: { credential: (email, password) => ({ email, password }) },
    async reauthenticateWithCredential(user, credential) {
      if (accounts.get(user.email)?.password !== credential.password)
        throw error('auth/invalid-credential');
    },
    async updatePassword(user, password) {
      accounts.get(user.email).password = password;
    },
  };
  const firestore = {
    doc: (_db, ...path) => path.join('/'),
    async getDoc(path) {
      return snapshot(path);
    },
    serverTimestamp: () => 'now',
    async runTransaction(_db, body) {
      const writes = new Map();
      await body({
        get: async (path) => snapshot(path),
        set: (path, data) => writes.set(path, data),
      });
      if (failProfile) throw error('permission-denied');
      for (const [path, data] of writes) docs.set(path, data);
    },
  };
  return { sdk: { auth, db: {}, authApi, firestore }, accounts, docs };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
const make = (fake) =>
  createAccount({ enabled: true, load: async () => fake.sdk, domain: () => 'p.firebaseapp.com' });

(async () => {
  // Without Firebase config nothing loads and the panel stays hidden.
  const off = createAccount({ enabled: false, load: () => assert.fail('must not load') });
  assert.equal(off.start(), null);
  assert.equal(off.state.status, 'disabled');

  // Register: account, login claim and profile; the login is shown as typed.
  const fake = fakeFirebase();
  const account = make(fake);
  let renders = 0;
  account.subscribe(() => renders++);
  assert.equal(account.state.status, 'loading');
  account.start();
  await settle();
  assert.equal(account.state.status, 'guest');
  await assert.rejects(account.register('Вaся', '123456', '123456'), /Не смешивай/);
  await assert.rejects(account.register('Алёна', '123456', '654321'), /Пароли не совпадают/);
  await account.register('Алёна', '123456', '123456');
  await settle();
  assert.deepEqual(account.state, { status: 'signedIn', uid: 'u1', login: 'Алёна' });
  assert.deepEqual(fake.docs.get('logins/алена'), { uid: 'u1' });
  assert.deepEqual(fake.docs.get('users/u1'), {
    login: 'Алёна',
    loginKey: 'алена',
    createdAt: 'now',
  });
  assert.ok(renders > 0);

  // The same login in another case or with «е» is taken.
  await account.signOut();
  await settle();
  assert.equal(account.state.status, 'guest');
  await assert.rejects(account.register('АЛЕНА', 'qwerty', 'qwerty'), /Логин занят/);

  // Sign in with any case; the profile login is shown.
  await assert.rejects(account.signIn('алена', 'wrong1'), /Неверный логин или пароль/);
  await account.signIn('алена', '123456');
  await settle();
  assert.equal(account.state.login, 'Алёна');

  // Change password: the current one is checked first.
  await assert.rejects(account.changePassword('nope', 'abcdef', 'abcdef'), /Неверный текущий/);
  await assert.rejects(account.changePassword('123456', 'abc', 'abc'), /не короче 6/);
  await account.changePassword('123456', 'abcdef', 'abcdef');
  await account.signOut();
  await settle();
  await assert.rejects(account.signIn('Алёна', '123456'), /Неверный логин или пароль/);
  await account.signIn('Алёна', 'abcdef');
  await settle();
  assert.equal(account.state.status, 'signedIn');

  // A remount (dispose, start) keeps listening to sign-ins.
  account.dispose();
  account.start();
  await settle();
  await account.signOut();
  await settle();
  assert.equal(account.state.status, 'guest');

  // If the profile cannot be written, the new account is removed so the login stays free.
  const broken = fakeFirebase({ failProfile: true });
  const second = make(broken);
  second.start();
  await settle();
  await assert.rejects(second.register('vasya', '123456', '123456'), /Сервер отклонил запрос/);
  await settle();
  assert.equal(broken.accounts.size, 0);
  assert.equal(second.state.status, 'guest');

  // A profile lost after registration is recreated on the next sign-in.
  const lost = fakeFirebase();
  const third = make(lost);
  third.start();
  await settle();
  await third.register('Petya', '123456', '123456');
  lost.docs.clear();
  await third.signOut();
  await settle();
  await third.signIn('petya', '123456');
  await settle();
  assert.equal(third.state.login, 'petya');
  assert.deepEqual(lost.docs.get('logins/petya'), { uid: 'u1' });

  // A failed SDK load shows the error and can be retried.
  let attempts = 0;
  const flaky = createAccount({
    enabled: true,
    load: async () => {
      if (attempts++ === 0) throw new Error('offline');
      return fakeFirebase().sdk;
    },
    domain: () => 'p.firebaseapp.com',
  });
  flaky.start();
  await settle();
  assert.equal(flaky.state.status, 'error');
  flaky.start();
  await settle();
  await settle();
  assert.equal(flaky.state.status, 'guest');

  console.log('Account checks passed.');
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
