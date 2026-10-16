# Firebase: что сделать владельцу проекта

Oct 16, 2026. Шаги, которые нужно сделать вам: доступ к консоли Firebase, Google-аккаунту и
настройкам репозитория GitHub есть только у вас. Код и правила пишутся по
[FIREBASE-PLAN.md](FIREBASE-PLAN.md). Всё ниже бесплатно на тарифе Spark, карта не нужна.

## 1. Создать проект (≈5 минут)

1. Откройте https://console.firebase.google.com и нажмите **Создать проект**.
2. Имя, например `utreys-survivors`. Google Analytics можно отключить, он не нужен.
3. Тариф оставьте **Spark** (бесплатный).

## 2. Зарегистрировать веб-приложение

1. В обзоре проекта нажмите значок **</>** (Web).
2. Имя приложения: `Utreys Survivors`. Галочку Firebase Hosting **не ставьте**: сайт остаётся
   на GitHub Pages.
3. Скопируйте объект `firebaseConfig` (`apiKey`, `authDomain`, `projectId`, `storageBucket`,
   `messagingSenderId`, `appId`). Это не секрет: эти значения всё равно попадают в код сайта,
   защиту дают правила Firestore.

## 3. Включить вход

Игроки входят по логину и паролю. Внутри Firebase это провайдер Email/Password: игра сама
превращает логин в служебный адрес, игрок email не вводит.

**Build → Authentication → Get started → Sign-in method**:

1. **Email/Password** → включите первый переключатель (**Email/Password**). Второй
   (**Email link / passwordless sign-in**) оставьте выключенным → Save.
2. Другие провайдеры (Google, Anonymous и т. д.) не включайте.
3. Вкладка **Settings → Authorized domains** → **Add domain** → `herrrihter.github.io`.
   `localhost` там уже есть.
4. Вкладка **Settings → User account linking** — не трогайте. **Settings → User actions** —
   оставьте «Enable create (sign-up)» включённым, иначе игроки не смогут
   зарегистрироваться.

## 4. Создать Firestore

**Build → Firestore Database → Create database**:

1. Режим **Standard**.
2. Регион: `eur3 (europe-west)` или ближайший к игрокам. **Регион потом не меняется.**
3. Режим правил — **Production mode** (всё закрыто). Настоящие правила выкатятся на шаге 7.

## 5. Передать конфигурацию в проект

Локально: создайте в корне репозитория файл `.env.local` (он в `.gitignore`, в Git не попадёт):

```text
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

Либо просто пришлите мне `firebaseConfig` в чат, и я создам файл сам.

Для GitHub Pages: репозиторий → **Settings → Secrets and variables → Actions → Variables →
New repository variable**. Добавьте те же шесть переменных с теми же именами. Workflow сборки
я изменю, чтобы он их читал.

## 6. Установить Firebase CLI и войти

Нужно для выкатки правил и для эмулятора в тестах.

```bash
npm install -g firebase-tools
```

```bash
firebase login
```

Вход открывает браузер и привязывает CLI к вашему Google-аккаунту. Этот шаг за вас сделать
нельзя.

Для эмулятора Firestore (`npm.cmd run test:rules`) нужна Java 21 или новее; установленная у
вас Java 26 подходит. Если эмулятор падает с «Unable to establish loopback connection»,
укажите Java отдельную папку для служебных сокетов и запустите снова:

```powershell
New-Item -ItemType Directory -Force C:\Temp | Out-Null; $env:JAVA_TOOL_OPTIONS='-Djdk.net.unixdomain.tmpdir=C:\Temp'; npm.cmd run test:rules
```

Если после теста эмулятор остался висеть и следующий запуск пишет «port taken», завершите
процесс `java.exe` в диспетчере задач. Сама игра и `npm test` Java не требуют.

## 7. Выкатить правила

Сразу после шага 4: без правил база закрыта и регистрация не работает. Проект `utrace-survivors`
уже указан в `.firebaserc`. Запустите из корня репозитория:

```bash
firebase deploy --only firestore:rules,firestore:indexes --project utrace-survivors
```

Подставьте свой Project ID, если он другой. Составных индексов таблицам не нужно: Firestore
сам индексирует поля статистики. Каждое изменение правил выкатывается этой же командой.

Когда добавляется новая карта, правила тоже меняются (в них список карт), и эту команду
нужно запустить снова, иначе статистика по новой карте не запишется.

## 8. Проверить после публикации

1. Откройте сайт на GitHub Pages: в меню должна появиться кнопка «Войти».
2. Зарегистрируйтесь с логином, например `Тест1`. В **Authentication → Users** появился
   пользователь с адресом из цифр и букв a–f `…@<projectId>.firebaseapp.com` — это
   закодированный логин, так и должно быть. В **Firestore → Data → logins** появился документ
   `тест1`.
3. Сыграйте забег: в **Firestore → Data → stats** у вашего uid выросли `games`, `totalKills`
   и `totalCodes` в `all` и в карте, на которой играли. Забег появился в «Лидерах».
4. Откройте игру во втором браузере и войдите тем же логином: прогресс подтянулся.

## Если игрок забыл пароль

Почты у аккаунтов нет, а кнопка **Reset password** в консоли отправляет письмо, которое
никуда не дойдёт. Задать пароль прямо в консоли нельзя, поэтому сброс делает скрипт
`tools/reset-password.cjs` (появится на этапе 1) через Firebase Admin SDK.

Один раз подготовьте ключ:

1. **Project settings → Service accounts → Generate new private key** — скачается JSON.
2. Положите его **вне репозитория**, например `C:\keys\utreys-admin.json`. Это настоящий
   секрет: с ним можно менять любые аккаунты. Никому не пересылайте, в чат тоже.

Сброс пароля игроку:

```powershell
$env:GOOGLE_APPLICATION_CREDENTIALS='C:\keys\utreys-admin.json'; npm run admin:reset-password -- <логин> <новый-пароль>
```

Логин пишется как обычно, в любом регистре; скрипт сам найдёт аккаунт. В списке
**Authentication → Users** аккаунт по логину не узнать, потому что адрес закодирован: uid
игрока можно найти в **Firestore → Data → logins → <логин в нижнем регистре, ё → е>**.

Передайте игроку новый пароль; сменить его на свой он сможет в игре. Прогресс и место в
таблице сохраняются, потому что аккаунт тот же.

## 9. По желанию

- **Предупреждение о расходах.** Даже на Spark полезно видеть нагрузку: **Firestore →
  Usage**. Лимиты: 50 тыс. чтений, 20 тыс. записей, 20 тыс. удалений в день.
- **App Check** (защита от запросов не с вашего сайта): **Build → App Check →
  Register** веб-приложение с reCAPTCHA v3 (ключ создаётся на
  https://www.google.com/recaptcha/admin для домена `herrrihter.github.io`). Пришлите мне
  site key: я подключу его в коде, после чего вы включите **Enforce** для Firestore.
- **Доступ для соавторов:** **Project settings → Users and permissions**.

## Что прислать мне

- `firebaseConfig` (или подтверждение, что `.env.local` создан).

## Принятые решения

- Логин: кириллица или латиница (не вперемешку), цифры, `_`, `-`, 3–16 символов, без учёта
  регистра, «ё» и «е» не различаются.
- Логин и есть имя в таблицах, отдельного отображаемого имени нет.
- Таблицы: лучший забег по времени, убийствам и кодам, победа, «Продакшен», а также всего
  убийств, всего кодов и всего игр. Каждая — общая и по каждой карте. Плюс экран «Моя
  статистика».
