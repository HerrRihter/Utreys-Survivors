import { createStore } from '../app/store.js';
import { cloudEnabled, loadFirebase, loginDomain } from './firebase.js';
import {
  authErrorText,
  loginEmail,
  loginError,
  loginKey,
  normalizeLogin,
  passwordError,
} from './login.js';

// The player's account: register, sign in and out, change the password. The UI reads `state`
// and re-renders on the store; every action rejects with an Error whose message is shown as is.
//
// status: 'disabled' (no Firebase config) | 'loading' | 'guest' | 'signedIn' | 'error'
export function createAccount({
  enabled = cloudEnabled(),
  load = loadFirebase,
  domain = loginDomain,
} = {}) {
  const store = createStore();
  let state = { status: enabled ? 'loading' : 'disabled', login: '', uid: '' },
    ready = null,
    unsubscribe = null,
    listening = false,
    // While register() creates the profile, the auth listener must not race it.
    registering = false,
    // The login typed on sign-in, used if the profile has to be recreated.
    typedLogin = '';
  const set = (next) => {
    state = { ...state, ...next };
    store.emit();
  };
  const fail = (text) => new Error(text);
  const failWith = (error) => fail(authErrorText(error));

  // Starts loading the SDK and listening to sign-ins; the menu calls this once it is on
  // screen. Safe to call again after dispose() (React remounts) or after a failed load.
  function start() {
    if (!enabled) return null;
    if (!ready) {
      if (state.status === 'error') set({ status: 'loading' });
      ready = load();
      ready.catch(() => {
        ready = null;
        listening = false;
        set({ status: 'error' });
      });
    }
    if (!listening) {
      listening = true;
      ready
        .then((sdk) => {
          if (listening && !unsubscribe)
            unsubscribe = sdk.authApi.onAuthStateChanged(sdk.auth, (user) => onUser(sdk, user));
        })
        .catch(() => {});
    }
    return ready;
  }
  async function sdkOrFail() {
    try {
      return await (ready || start());
    } catch {
      throw fail('Нет связи с сервером');
    }
  }

  // Claims the login and writes users/{uid} in one transaction (see firestore.rules).
  async function createProfile(sdk, uid, login) {
    const { doc, runTransaction, serverTimestamp } = sdk.firestore;
    const key = loginKey(login);
    await runTransaction(sdk.db, async (tx) => {
      const claim = doc(sdk.db, 'logins', key);
      const taken = await tx.get(claim);
      if (taken.exists() && taken.data().uid !== uid)
        throw Object.assign(new Error('login-taken'), { code: 'login-taken' });
      if (!taken.exists()) tx.set(claim, { uid });
      tx.set(doc(sdk.db, 'users', uid), {
        login: normalizeLogin(login),
        loginKey: key,
        createdAt: serverTimestamp(),
      });
    });
  }

  async function onUser(sdk, user) {
    if (!user) {
      set({ status: 'guest', login: '', uid: '' });
      return;
    }
    if (registering) return;
    let login = '';
    try {
      const { doc, getDoc } = sdk.firestore;
      const profile = await getDoc(doc(sdk.db, 'users', user.uid));
      if (profile.exists()) login = profile.data().login;
      else {
        // An earlier registration stopped after the account was created.
        login = typedLogin || decodeKey(user.email);
        await createProfile(sdk, user.uid, login);
      }
    } catch {
      login ||= typedLogin || decodeKey(user.email);
    }
    set({ status: 'signedIn', uid: user.uid, login });
  }

  async function register(login, password, repeat) {
    const error = loginError(login) || passwordError(password, repeat);
    if (error) throw fail(error);
    const sdk = await sdkOrFail();
    registering = true;
    try {
      let credential;
      try {
        credential = await sdk.authApi.createUserWithEmailAndPassword(
          sdk.auth,
          loginEmail(login, domain()),
          password,
        );
      } catch (e) {
        throw failWith(e);
      }
      try {
        await createProfile(sdk, credential.user.uid, login);
      } catch (e) {
        // Without a profile the login is not ours: remove the account so it can be retried.
        await sdk.authApi.deleteUser(credential.user).catch(() => {});
        throw failWith(e);
      }
      set({ status: 'signedIn', uid: credential.user.uid, login: normalizeLogin(login) });
    } finally {
      registering = false;
    }
  }

  async function signIn(login, password) {
    if (loginError(login) || typeof password !== 'string' || !password)
      throw fail('Неверный логин или пароль');
    const sdk = await sdkOrFail();
    typedLogin = normalizeLogin(login);
    try {
      await sdk.authApi.signInWithEmailAndPassword(sdk.auth, loginEmail(login, domain()), password);
    } catch (e) {
      throw failWith(e);
    }
  }

  async function signOut() {
    const sdk = await sdkOrFail();
    typedLogin = '';
    await sdk.authApi.signOut(sdk.auth);
  }

  async function changePassword(current, next, repeat) {
    const error = passwordError(next, repeat);
    if (error) throw fail(error);
    const sdk = await sdkOrFail();
    const user = sdk.auth.currentUser;
    if (!user) throw fail('Сначала войдите');
    try {
      const credential = sdk.authApi.EmailAuthProvider.credential(user.email, current);
      await sdk.authApi.reauthenticateWithCredential(user, credential);
    } catch (e) {
      throw fail(
        e?.code === 'auth/too-many-requests' ? authErrorText(e) : 'Неверный текущий пароль',
      );
    }
    try {
      await sdk.authApi.updatePassword(user, next);
    } catch (e) {
      throw failWith(e);
    }
  }

  function dispose() {
    listening = false;
    unsubscribe?.();
    unsubscribe = null;
  }

  return {
    subscribe: store.subscribe,
    getVersion: store.getVersion,
    get state() {
      return state;
    },
    start,
    // The loaded SDK for other services (cloud progress, statistics).
    firebase: sdkOrFail,
    register,
    signIn,
    signOut,
    changePassword,
    dispose,
  };
}

// The login key back from the service address, for profiles that have to be recreated.
function decodeKey(email) {
  const hex = String(email || '').split('@')[0];
  if (!/^(?:[0-9a-f]{2})+$/.test(hex)) return '';
  try {
    return new TextDecoder().decode(
      new Uint8Array(hex.match(/../g).map((byte) => parseInt(byte, 16))),
    );
  } catch {
    return '';
  }
}
