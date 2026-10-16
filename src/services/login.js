// Logins and passwords without Firebase: format checks, the case-insensitive key and the
// service address Firebase Auth signs in with. Shared by the game and tools/reset-password.cjs.

export const LOGIN_MIN = 3;
export const LOGIN_MAX = 16;
export const PASSWORD_MIN = 6;

const latin = /^[a-z0-9_-]+$/i;
const cyrillic = /^[а-яё0-9_-]+$/i;

export const normalizeLogin = (login) =>
  String(login ?? '')
    .normalize('NFC')
    .trim();

// The error to show for a login, or null when it is valid.
export function loginError(login) {
  const value = normalizeLogin(login),
    length = [...value].length;
  if (length < LOGIN_MIN || length > LOGIN_MAX)
    return `Логин: от ${LOGIN_MIN} до ${LOGIN_MAX} символов`;
  if (latin.test(value) || cyrillic.test(value)) return null;
  if (/[a-z]/i.test(value) && /[а-яё]/i.test(value)) return 'Не смешивай кириллицу и латиницу';
  return 'Логин: буквы, цифры, «_» и «-»';
}

export function passwordError(password, repeat) {
  if (typeof password !== 'string' || password.length < PASSWORD_MIN)
    return `Пароль: не короче ${PASSWORD_MIN} символов`;
  if (repeat !== undefined && repeat !== password) return 'Пароли не совпадают';
  return null;
}

// «Алёна», «алена» and «АЛЕНА» are one login.
export const loginKey = (login) => normalizeLogin(login).toLowerCase().replaceAll('ё', 'е');

// Firebase Auth accepts only ASCII addresses reliably, so the key goes in as UTF-8 hex:
// 16 Cyrillic letters are 64 characters, the limit for the part before «@».
export function loginEmail(login, domain) {
  const hex = [...new TextEncoder().encode(loginKey(login))]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
  return `${hex}@${domain}`;
}

const authErrors = {
  'auth/email-already-in-use': 'Логин занят',
  'login-taken': 'Логин занят',
  'auth/invalid-credential': 'Неверный логин или пароль',
  'auth/wrong-password': 'Неверный логин или пароль',
  'auth/user-not-found': 'Неверный логин или пароль',
  'auth/invalid-email': 'Неверный логин или пароль',
  'auth/weak-password': `Пароль: не короче ${PASSWORD_MIN} символов`,
  'auth/too-many-requests': 'Слишком много попыток, подожди',
  'auth/network-request-failed': 'Нет связи с сервером',
  'auth/user-disabled': 'Аккаунт отключён',
  'auth/operation-not-allowed': 'Вход по паролю не включён в Firebase',
  unavailable: 'Нет связи с сервером',
  // Firestore Lite reports a refused or dropped connection as `unknown`.
  unknown: 'Нет связи с сервером',
  'deadline-exceeded': 'Нет связи с сервером',
  'permission-denied': 'Сервер отклонил запрос',
};

export const authErrorText = (error) =>
  authErrors[error?.code] || 'Не получилось, попробуй ещё раз';
