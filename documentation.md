# Техническая документация

Актуальная версия: пять героев Utrace, три карты (дата-центр empty, серверный зал serverRoom, сервисдеск Пепси pepsiDesk) и экспериментальная учебная карта learningLab с мини-тестами ([план и правила](docs/LEARNING-MAP-IMPLEMENTATION-PLAN.md)), противники, баги-минибоссы узлов и босс ЦРПТ. Запуск и команды описаны в [README](README.md).

Модификации героя, цены и атаки описаны в [HEROES](docs/HEROES.md), противники и условие босса — в [ENEMIES-AND-NODES](docs/ENEMIES-AND-NODES.md), слои и правила кода — в [контракте структуры](docs/STRUCTURE-CONTRACT.md).

## Архитектура

Код разложен по слоям; кто кого может импортировать, задаёт матрица в tools/structure-contract.json, её проверяет `npm test`:

data → core → world → systems → services → rendering → ui → app → components → src.

- **data** — определения: герои, умения, оружие, улучшения, враги, волны, узлы, карты, предметы, достижения. Новое оружие, умение, событие или предмет — запись с полем `kind`, поведение вида — в реестре systems (src/systems/weapons/, src/systems/abilities/, `attackKinds`, `projectileKinds`, `eventKinds`, `pickupKinds`).
- **core** — без игры: хранилище (storage.js, migrations.js), RNG (rng.js), фиксированный шаг (game-loop.js), ввод, звук, graph-json.js (сериализация с общими ссылками), math.js (clamp и единые проверки прямоугольников `inBox`, `boxesOverlap`, `near`).
- **world** — геометрия арены: стойки карты как прямоугольники, коллизия «капсула против прямоугольника» (collision.js: `clear`, `blocked`, `outlines`) и поле навигации (navigation.js).
- **systems** — симуляция забега: модель забега (run-model.js, все поля `run.state` и их схема сохранения), бой, враги, волны, оружие, умения, события, прогрессия аккаунта (systems/progression/). Только меняют состояние: Canvas, `Math.random`, `Date.now` и `performance.now` здесь запрещены. Чистые запросы для рисования — systems/queries/.
- **services** — Firebase: вход, облачный прогресс, таблица лидеров, статистика забегов.
- **rendering** — Canvas: сцена, враги, герой, эффекты, пол арены, отладочные контуры коллизии.
- **ui** — без React: портреты меню (menu-portraits.js), тексты бестиария (opponent-details.ts), тайминги волн (wave-preview.js).
- **app** — стык игры и React. src/app/game-session.js — композиционный корень: создаёт системы (run-systems.js) и передаёт каждой в `create({...})` только её зависимости; общее изменяемое состояние экрана — объект `run` (src/app/run-state.js). game-flow.js собирает жизненный цикл забега (run-lifecycle.js, учёт окончаний — run-recording.js), левелап (level-up.js) и навигацию по меню (navigation.js). Таймеры кадра — frame-timers.js, портреты меню — portraits.js, журнал забегов как файл — run-log-file.js, то, что видит React, — session-views.js и session-commands.js. Чистые представления — src/app/views/ (по модулю на экран, итоги забега — views/result.js, общие текстовые шаблоны — views/format.js). Страницы арены и бестиария получают всё из `createPreviewKit` (preview-kit.js), сами рисунки — src/rendering/previews.js.
- **components** — React, импортирует только app: GameView, экраны меню (components/menus/: MainMenu, HeroSelect, Shop, Encyclopedia, Achievements, Settings), GameRunScreens, GameHud, страницы ArenaView и OpponentsView (выбор любой карты), Overlay, Dialog.

src/main.tsx монтирует React StrictMode. App переключает игру и страницы, сохраняя GameView. src/app/useGameSession.ts создаёт на mount прогресс (createProgression) и GameSession на canvas, вызывает run/stop при переключении экрана и dispose на unmount. dispose освобождает RAF, ввод, аудио, resize и подписки; повторный вызов безопасен.

Сессия отдаёт React два хранилища для useSyncExternalStore: ui (меняется на каждом дискретном событии) и hud (не чаще 10 раз в секунду из игрового цикла), представления и команды (session.commands). Строка сборки в HUD пересобирается только при изменении сборки (`upgrades.buildKey`). Какая панель открыта, определяется run.mode и run.screen. Overlay берёт фокус, удерживает Tab и возвращает фокус при закрытии.

Модули не читают глобалы при импорте: прогресс, враги, трупы и арены создаются фабриками (createProgression, createEnemyRenderer, createCorpses, createArenas), браузерные объекты (document, window, хранилище, requestAnimationFrame) передаются сессии.

## Детерминизм

Симуляция идёт фиксированными шагами 1/60 с. Всё случайное в игре берётся из `state.rng` (src/core/rng.js), созданного из сида забега; косметика (искры, тряска, варианты звука) — из отдельного источника сессии. Забег повторяется из сида и записанного ввода: tests/golden-replay.test.js проигрывает 15 пар герой × карта дважды, в другом процессе и с сохранением на середине. `node tests/helpers/replay-child.js` печатает финальные хэши всех повторов — одинаковый вывод двух коммитов показывает, что изменение не тронуло ни одного забега.

## Ресурсы и производство

Игра рисует персонажей на Canvas; при загрузке движка изображения не запрашиваются. Vite публикует только файлы tools/active-assets.json (звук в assets/runtime/audio), JS/CSS приложения и две страницы-перенаправления (arena-preview.html, opponents-preview.html — старые адреса). URL ресурсов привязан к document.baseURI и base Vite; smoke проверяет корень сайта и префикс репозитория.

## Проверки

- `npm test` — vitest: все tests/\*.test.js, включая проверку контракта структуры и контрактов контента (tests/contracts.test.js). Тесты сессии используют tests/helpers/game-harness.js — сессию на поддельных document, window, хранилище и кадрах.
- `npm run check` — ESLint (@eslint/js recommended), tsc, Prettier, тесты и сборка.
- `npm run test:browser` и `npm run test:layout` — после `npm run build`; страницу отдаёт `preview()` из Vite (tools/preview-server.cjs), как `npm run preview`. Smoke проверяет production, ресурсы, запуск/паузу, Q/E, навигацию, настройки, ширины экрана, модальный фокус и предпросмотр, затем tools/learning-browser.cjs проходит учебную карту (комнаты, тесты на телефоне, перезагрузка, призыв босса, возрождение, победа); layout обходит экраны на 21 размере, включая учебный HUD, тест и возрождение. Локально можно задать BROWSER_CHANNEL=msedge.
- `npm run benchmark` — симуляция (волны и 300 врагов) на ESM-харнессе; `npm run benchmark:render` — отрисовка в браузере.
- `npm run test:rules` — правила Firestore на эмуляторе.

## Сохранения

Все ключи localStorage читаются и пишутся через persisted() из src/core/storage.js. Прогресс аккаунта — utreys-progression-v1 (модули systems/progression/: кошелёк, магазин, рекорды, достижения, уровни нагрузки; рекорд лучшего забега — stats.maxTime и stats.maxKills; прежний ключ utreys-best сливается в него один раз), настройки — utreys-settings, звук — utreys-audio, показанные подсказки — utreys-tips. Незаконченный забег хранится в utreys-run-v5 целиком (src/systems/run-snapshot.js; utreys-run-v1…v4 переводятся при чтении, см. [WEAPONS-AND-RUN](docs/WEAPONS-AND-RUN.md)). Старые форматы прогресса (helmets → codes, helmets_100 → codes_100 без повторной награды, gaul-audio → utreys-audio) переводит src/core/migrations.js. Перед изменением формата сохранения нужна миграция. Доход от боя сохраняется пакетно; flush вызывается при уходе со страницы и dispose.

## Аккаунт и облако

Вход по логину и паролю через Firebase — `src/services` (план и статус — [FIREBASE-PLAN](docs/FIREBASE-PLAN.md), настройка — [FIREBASE-SETUP](docs/FIREBASE-SETUP.md)). Включается переменными `VITE_FIREBASE_*` из `.env.local` или переменных GitHub Actions; без них панель аккаунта скрыта и SDK не загружается. Логин превращается в служебный адрес `hex(ключ)@<projectId>.firebaseapp.com`, ключ — нижний регистр и «ё» → «е». Прогресс вошедшего игрока синхронизируется с `progress/{uid}` (`src/services/cloud-progress.js`): локальное сохранение остаётся основным, при расхождении с облаком на двух устройствах игрок выбирает, какое оставить; метаданные устройства — в `utreys-cloud-v1`. `VITE_FIREBASE_EMULATOR=127.0.0.1` подключает локальные эмуляторы: положите демо-конфигурацию (`VITE_FIREBASE_PROJECT_ID=demo-utreys` и т. д.) в `.env.emulator.local`, запустите `npx firebase emulators:start --only auth,firestore --project demo-utreys` и `npx vite --mode emulator --port 3001`. Правила проверяет `npm run test:rules`. Забытый пароль сбрасывает `npm run admin:reset-password`.

## Реплики и палитра

Справочник реплик — data/enemies/phrases.js. Ключ — ID противника, значение — список коротких фраз; пустой список отключает реплики. Настройки duration, interval и perEnemyCooldown задают длительность, общий интервал и паузу для одного врага в секундах. Реплики появляются у видимых живых врагов и останавливаются на паузе. Подробный пример — в docs/CONTENT-CLEANUP-2026-10-15.md.

Палитра героев задана в src/rendering/art/utrace-hero.js, клиентов — в client-emblems.js рядом. Основные заливки приглушены; тонкие неоновые контуры сохранены.

## Стиль и поддержка

TypeScript проверяется в strict с запретом неиспользуемых локальных значений и параметров. JavaScript остаётся JS (часть модулей — с `// @ts-check`); его проверяют ESLint и тесты. Цветовые токены и стили страниц определены в styles/game.css; в разметке inline остаются только значения из данных (цвет врага, ширина полосы). Canvas получает обычные цветовые значения, а не CSS var().
