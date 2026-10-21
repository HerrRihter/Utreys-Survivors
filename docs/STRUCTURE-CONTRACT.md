# Контракт структуры

Актуален для Utrace Survivors после миграции 15 октября 2026 года, слои — с 20 октября 2026 года, хранилище и прогрессия — с этапа 6 рефакторинга, тесты на vitest и чистка — с этапа 7, стык игры и интерфейса (React только через app) — с 20 октября 2026 года. Машинные правила: tools/structure-contract.json; публикация: tools/active-assets.json.

| Путь                      | Назначение                                                                                 |
| ------------------------- | ------------------------------------------------------------------------------------------ |
| src/main.tsx, src/App.tsx | Единственная production-точка входа и навигация                                            |
| src/app                   | Сессия и её части, жизненный цикл забега, навигация, представления (views/), превью-кит    |
| src/components            | Весь React-интерфейс: экраны меню (menus/), экраны забега, HUD, страницы, модальные панели |
| src/core                  | Время, ввод, звук, хранилище, RNG, пути ресурсов, store, математика и прямоугольники       |
| src/systems               | Игровая механика; src/systems/queries — чистые запросы к состоянию забега                  |
| src/services              | Облако (Firebase): вход, облачный прогресс, таблица лидеров; без конфигурации выключено    |
| src/world                 | Арены: стойки-прямоугольники, коллизия капсулы, навигация                                  |
| src/rendering             | Вся отрисовка: сцена, арт, враги, эффекты, снаряды, оружие, трупы, пол арены, камера       |
| src/ui                    | Портреты меню, тексты бестиария, тайминги волн для превью (без React)                      |
| data                      | Определения контента, реплик и таймингов анимаций                                          |
| styles                    | CSS и семантические токены                                                                 |
| tools, tests              | Проверка контрактов, браузерные проверки, бенчмарки; тесты vitest (tests/*.test.js)        |
| assets/runtime            | Публикуемые ресурсы (звук); каждый файл перечислен в tools/active-assets.json              |
| assets/source             | Место для авторских источников (сейчас пусто), вне публикации                              |
| docs                      | Действующие инструкции, план и аудит; исторические материалы — в истории git               |
| dist                      | Vite-результат; не хранится в Git                                                          |

В корне index.html и две совместимые ссылки-перенаправления. Старого компилятора file://, runtime-бандлов и отдельных HTML-приложений больше нет. Основной способ запуска — HTTP через Vite: `npm run dev`, собранный dist — `npm run preview` (тот же `preview()` используют smoke, layout и бенчмарк отрисовки, tools/preview-server.cjs).

## Инварианты

- Публикуемые ресурсы только в assets/runtime; категории и имена проверяет check:structure, каждый файл там опубликован (active-assets.json), неопубликованный — ошибка.
- Каждый ресурс из active-assets.json существует и копируется Vite в dist/assets/runtime с тем же относительным именем.
- Персонажи рисуются Canvas-кодом; старые реестры кадров и генераторы больше не используются.
- Реплики определены в data/enemies/phrases.js и проверяются на соответствие текущим ID противников.
- Производственные данные определяются в data. Добавление юнита обновляет данные, метаданные бестиария и поведенческие проверки; числовые характеристики не дублируются в текстах.
- Новые tests/\*.test.js подхватывает vitest (`npm test`); тесты сессии собирают её через
  tests/helpers/game-harness.js на поддельных браузерных объектах. Нельзя исправлять падения общих механизмов отключением suites.
- Перед изменением формата сохранений нужна миграция; перед удалением ресурсов — проверка статических и динамических потребителей.

## Слои и разрешённые импорты

Порядок слоёв: `data → core → world → systems → services → rendering → ui → app → components → src`
(src — точки входа main.tsx и App.tsx). Файл может импортировать только свой слой и слои, перечисленные
в его строке матрицы `layers` в tools/structure-contract.json. Проверяет `checkLayers` в
tools/check-structure.cjs (часть `npm test` и `npm run check:structure`), тест —
tests/structure-layers.test.js. Учитываются статические, `export … from`, `import type` и
динамические `import()` с относительным путём; пакеты (react, firebase) не проверяются.

| Слой            | Может импортировать                                                   |
| --------------- | --------------------------------------------------------------------- |
| data            | ничего вне data                                                       |
| core            | data                                                                  |
| world           | data, core                                                            |
| systems         | data, core, world                                                     |
| systems/queries | data, core, world (чистые вопросы к состоянию, без остальных systems) |
| services        | data, core, systems                                                   |
| rendering       | data, core, world, systems/queries                                    |
| ui              | data, systems                                                         |
| app             | data, core, world, systems, services, rendering, ui                   |
| components      | app                                                                   |
| src             | components                                                            |

Слой всегда видит свои подслои (systems → systems/queries). React (components) видит игру только
через app, включая `import type`: сессию с её представлениями и командами (src/app/game-session.js),
превью-кит страниц арены и бестиария (`createPreviewKit`, src/app/preview-kit.js), чистые
представления (src/app/views/), облачные функции (src/app/cloud.js) и типы (src/app/types.ts).
Точки входа видят только components. Новая папка в src без строки в матрице —
ошибка. Сообщение о нарушении называет файл, оба слоя и список разрешённого.

Правила, которые матрица не выражает:

- Симуляция не читает клавиатуру и настройки: core/input.js собирает намерение движения в
  `run.move` (клавиши, стрелки, стик) перед каждым шагом. Пока сессия спит за другой страницей,
  `input.disable()` выключает клавиатурные команды; страница вида (`body.dataset.view`) вводом не
  читается.
- Определения героев и врагов системы берут прямо из data (data/characters/heroes.js,
  data/enemies/units.js); рендереры (`createEnemyRenderer`, `createCorpseRenderer`) создаёт каждый
  вид сам — сессия и бестиарий держат свои экземпляры, общих синглтонов нет.
- В src/systems и src/world нет вызовов Canvas API (`getContext`, `fillRect`, `strokeRect`,
  `beginPath`, `arc(`, `drawImage`, `fillText`); проверяет `checkNoCanvas` в tools/check-structure.cjs.
- Забег воспроизводим по сиду и вводу. Всё, что меняет исход (карточки, спавн, элиты, дропы, криты,
  поведение врагов, события, разброс мин и зон), берёт случайность из `state.rng` забега
  (`createGameRng(seed)`, src/core/rng.js). Искры, тряска экрана, фазы анимации, варианты звука —
  из косметического источника `cosmetic`, который сессия передаёт системам и рендереру. В src/systems
  и src/world нет `Math.random`, `Date.now`, `performance.now`; проверяет `checkNoGlobalRandom` в
  tools/check-structure.cjs (тест tests/structure-random.test.js). Кэши мира (поле навигации)
  зависят только от текущего состояния, не от истории вызовов.
- Симуляция идёт фиксированным шагом `STEP` = 1/60 с (core/game-loop.js `createFixedStep`): время
  кадров копится, кадр делает не больше `MAX_STEPS` = 5 шагов, остаток зависшего кадра
  отбрасывается; рисование — раз за кадр. Таймеры игрового времени (автосохранение раз в 30 с,
  проверка и показ подсказок) считают сыгранные шаги; таймеры интерфейса (HUD 10 Гц, блокировка
  левелапа, тост, портреты меню) — реальное время кадра. `session.update(dt)` делает один шаг
  произвольной длины — для тестов и инструментов.
- Правила игры и отрисовка не ветвятся по id контента: в src/systems и src/rendering нет строковых
  литералов, равных id оружия, героя, умения, юнита, карты, события или подбираемого предмета
  (`=== 'orbit'`, `case 'friday'`, `abilityActive(s, 'overclock')`). Поведение берётся из данных и
  реестров видов: оружие `src/systems/weapons/` (`kind` в data/weapons.js), снаряды
  `src/systems/projectiles.js`, атаки героя `attackKinds`, умения `src/systems/abilities/`, события
  `eventKinds`, предметы `pickupKinds` (data/pickups.js); рисовальщики — по тем же видам. Арт по id
  (unitArt, heroAccessories) — ключи объектов, не литералы. Проверяет `checkContentIds` в
  tools/check-game-contracts.cjs (тест tests/content-ids.test.js); исключения — списком с причиной
  там же, неиспользуемое исключение — ошибка.
- Прямоугольники проверяются одной реализацией — `inBox`, `boxesOverlap`, `near` из
  src/core/math.js (отсечение по экрану, площадь эффекта, грубая проверка перед расстоянием). Стойки
  карты — прямоугольники `{ minX, minY, maxX, maxY }`; world/collision.js проверяет капсулу (отрезок
  шага с радиусом) против них и отдаёт `clear`, `blocked` и контуры `outlines`.
- Стили — в styles/game.css; в разметке inline остаются только значения из данных (цвет врага, его
  значка, ширина полосы).
- То, что зависит от экрана (кто из врагов говорит), вызывается из сессии с видимым прямоугольником
  мира, а не из шага симуляции.
- Типы, которые app отдаёт React (Session, Account, Leaderboard, PreviewKit, MapId, Metric, UnitKey),
  живут в src/app/types.ts.
- Всё, что игра хранит в localStorage, читается и пишется через `persisted(storage, key, { normalize,
migrate, legacyKeys })` из src/core/storage.js: ошибки хранилища и битый JSON не бросают исключений,
  значение под старым ключом переводится один раз. Больше нигде в src и data нет `getItem`, `setItem`,
  `removeItem` (единственное исключение — адаптер `window.localStorage` в src/app/useGameSession.ts);
  проверяет tests/storage.test.js. Ключи: `utreys-progression-v1`, `utreys-settings`, `utreys-tips`,
  `utreys-audio`, `utreys-run-v6`, `utreys-run-log-v1`, `utreys-stats-queue-v1`, `utreys-cloud-v1`.
  Переводы старых форматов (helmets → codes, gaul-audio, utreys-best) собраны в src/core/migrations.js
  с датой, после которой их можно удалить; цепочка снапшота забега v1…v5 — в src/systems/run-snapshot.js.
- Прогрессия аккаунта (src/systems/progression/) — общее хранилище `store.js` (данные, запись,
  подписчики) и модули над ним: `wallet` (коды и убийства), `shop` (герои, улучшения, сброс),
  `records` (время, рекорды, факты забега, статистика, эволюции), `achievements`, `loads` (нагрузки и
  продакшен); `normalize.js` чистит сохранение. Модуль меняет `store.data` и вызывает `save()` или
  `deferSave()`, они же поднимают версию. Снаружи данные видны только как `progression.data` —
  глубоко замороженная копия, общая для всех чтений до следующего изменения. Системы получают
  только нужные модули (бой — wallet и records, умения — records, симуляция и события — wallet,
  карточки — wallet и achievements).

Осознанные исключения и долги:

- ui стоит выше rendering, хотя рисует только через app: ему нужны полные systems (расписание волн
  для таймингов бестиария), а не только queries.
- Рисует только src/rendering: системы и мир меняют состояние и отдают геометрию данными
  (`collision.outlines`, `orbitShape` в systems/queries/weapons.js).

Исторический аудит PROJECT-STRUCTURE-AUDIT.md (docs/archive/legacy, теперь только в истории git) не является параллельным контрактом. Текущие команды: npm ci, npm run check, npm run test:browser.
