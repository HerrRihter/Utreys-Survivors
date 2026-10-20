# Техническая документация

Актуальная версия: пять героев Utrace, одна карта empty, 16 противников и пять багов-минибоссов. Запуск и команды описаны в [README](README.md).

Модификации героя, цены и атаки описаны в [HEROES](docs/HEROES.md), противники и условие босса — в [ENEMIES-AND-NODES](docs/ENEMIES-AND-NODES.md).

## Архитектура

src/main.tsx монтирует React StrictMode. App переключает экраны, сохраняя GameView. src/app/useGameSession.ts создаёт на mount прогресс (createProgression) и GameSession на canvas, вызывает run/stop при переключении экрана и dispose на unmount. dispose освобождает RAF, ввод, аудио, resize и подписки на события; повторный вызов безопасен.

src/app/game-session.js — композиционный корень: создаёт системы и передаёт каждой в create({...}) только её зависимости. Общее изменяемое состояние забега — объект run из src/app/run-state.js (state, mode, screen, выбор героя/клиента/карты, ввод). Циклы разорваны чистыми функциями: состояние умений читается через src/systems/ability-state.js, а ввод вызывает команды flow через замыкания в корне.

Весь интерфейс — React (src/components: GameView, GameMenus, GameRunScreens, GameHud, Overlay, Portrait). Сессия отдаёт два хранилища для useSyncExternalStore: ui (меняется на каждом дискретном событии) и hud (не чаще 10 раз в секунду из игрового цикла), чистые представления из src/app/views.js и команды (session.commands). Какая панель открыта, определяется run.mode и run.screen. Overlay берёт фокус, удерживает Tab и возвращает фокус при закрытии.

Модули не читают глобалы при импорте: прогресс, враги, трупы и арены создаются фабриками (createProgression, createEnemies, createCorpses, createArenas) с хранилищем и фабрикой offscreen-canvas. Определения героя, врагов, волн, способностей и улучшений находятся в data. Данные описаний бестиария находятся в src/ui/opponent-details.ts, а цикл предпросмотра — в useOpponentPreview.ts.

## Ресурсы и производство

Игра рисует текущих персонажей на Canvas. При загрузке движка старые PNG не запрашиваются. Vite публикует только файлы tools/active-assets.json, JS/CSS приложения и две страницы-перенаправления. URL ресурсов привязан к document.baseURI и base Vite; проверяются корень сайта и префикс репозитория.

Каталог runtime содержит audio и ui. Устаревшие покадровые реестры, генераторы и рендереры прежних персонажей удалены. Авторские материалы в assets/source не публикуются. Геометрия и навигация текущей арены находятся в src/world/collision.js и src/world/navigation.js.

## Проверки

npm test автоматически запускает все верхнеуровневые tests/test\*.cjs. Общие проверки геометрии, кадров, глубины, звука, сохранений и улучшений сохранены. Проверки удалённого контента заменены текущими сценариями; список выведенных файлов и причины — в docs/archive/RETIRED-2026-10-15.md.

Браузерный smoke проверяет production, HTTP-ресурсы, запуск/паузу, Q/E, навигацию, настройки, ширины экрана, модальный фокус и freeze предпросмотра. Сначала npm run build, затем npm run test:browser. Для CI устанавливается Chromium Playwright; локально можно задать BROWSER_CHANNEL.

## Сохранения

Ключи прогресса — utreys-progression-v1, utreys-best и utreys-settings. Незаконченный забег хранится в utreys-run-v2 (старый utreys-run-v1 переводится в v2 при чтении), показанные подсказки — в utreys-tips (см. [WEAPONS-AND-RUN](docs/WEAPONS-AND-RUN.md)). Валюта записывается в codes; при загрузке старого сохранения читается codes ?? helmets. Старое достижение helmets_100 переносится в codes_100 без повторной награды. Аудио записывается в utreys-audio; при отсутствии нового ключа настройки читаются из gaul-audio и копируются в новый. Доход от боя сохраняется пакетно; flush вызывается при уходе со страницы и disposal.

## Аккаунт и облако

Вход по логину и паролю через Firebase — `src/services` (план и статус — [FIREBASE-PLAN](docs/FIREBASE-PLAN.md), настройка — [FIREBASE-SETUP](docs/FIREBASE-SETUP.md)). Включается переменными `VITE_FIREBASE_*` из `.env.local` или переменных GitHub Actions; без них панель аккаунта скрыта и SDK не загружается. Логин превращается в служебный адрес `hex(ключ)@<projectId>.firebaseapp.com`, ключ — нижний регистр и «ё» → «е». Прогресс вошедшего игрока синхронизируется с `progress/{uid}` (`src/services/cloud-progress.js`): локальное сохранение остаётся основным, при расхождении с облаком на двух устройствах игрок выбирает, какое оставить; метаданные устройства — в `utreys-cloud-v1`. `VITE_FIREBASE_EMULATOR=127.0.0.1` подключает локальные эмуляторы: положите демо-конфигурацию (`VITE_FIREBASE_PROJECT_ID=demo-utreys` и т. д.) в `.env.emulator.local`, запустите `npx firebase emulators:start --only auth,firestore --project demo-utreys` и `npx vite --mode emulator --port 3001`. Правила проверяет `npm run test:rules`. Забытый пароль сбрасывает `npm run admin:reset-password`.

## Реплики и палитра

Справочник реплик — data/enemies/phrases.js. Ключ — ID противника, значение — список коротких фраз; пустой список отключает реплики. Настройки duration, interval и perEnemyCooldown задают длительность, общий интервал и паузу для одного врага в секундах. Реплики появляются у видимых живых врагов и останавливаются на паузе. Подробный пример — в docs/CONTENT-CLEANUP-2026-10-15.md.

Палитра героев задана в src/rendering/art/utrace-hero.js, клиентов — в client-emblems.js рядом. Основные заливки приглушены; тонкие неоновые контуры сохранены.

## Стиль и поддержка

TypeScript проверяется в strict с запретом неиспользуемых локальных значений и параметров. JavaScript остаётся JS: checkJs не включён; его проверяют ESLint и тесты. ESLint проверяет структурные ошибки JS/CJS; TSX проходит tsc и Prettier. Цветовые токены определены в styles/game.css и используются React-компонентами. Canvas получает обычные цветовые значения, а не CSS var().

Полное переписывание движка на TypeScript не является условием этой миграции. Добавляйте типы и более узкие интерфейсы по мере изменения подсистем. Текущий набор ресурсов и проверок должен оставаться воспроизводимым.
