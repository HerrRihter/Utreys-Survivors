# Utrace Survivors

Браузерная survival arena на React, TypeScript, Canvas и Vite: пять модификаций героя Utrace, арена дата-центра, 16 противников и пять багов-минибоссов, активные умения Q/E, улучшения и локальные сохранения.

## Разработка

Требуется Node.js 22 или новее. Версии пакетов закреплены в package-lock.json.

```sh
npm ci
npm run dev
```

Откройте http://localhost:3000. Прямой запуск index.html через file:// не поддерживается.

## Проверки и сборка

```sh
npm run check
npx playwright install chromium
npm run test:browser
```

check выполняет линт JavaScript, строгую проверку TypeScript, проверку форматирования, все тесты, контракты и production-сборку. test:browser проверяет уже собранный dist. На Windows можно использовать установленный Edge: `$env:BROWSER_CHANNEL='msedge'; npm.cmd run test:browser`. Если PowerShell блокирует npm.ps1, используйте npm.cmd вместо npm.

- `npm test` — все тестовые файлы tests/test*.cjs, автоматически.
- `npm run format` — форматирование исходников.
- `npm run check:structure` — проверка структуры и ресурсов.
- `npm run build` — сборка в dist.
- `npm run preview` — просмотр production-сборки на порту 3000.

GitHub Actions выполняет те же проверки и браузерный smoke для PR. Публикация dist в GitHub Pages выполняется только для main/master и ручного запуска, после проверок.

## Навигация

Основная игра — `/`, просмотр арены — `/?view=arena`, противники — `/?view=opponents`. Старые адреса opponents-preview.html и arena-preview.html перенаправляют на соответствующие экраны.

[Техническая документация](documentation.md) · [Контракт структуры](docs/STRUCTURE-CONTRACT.md) · [Индекс документов](docs/README.md)

Цель забега: освободить пять узлов компонентов, уничтожая охраняющих их багов или находя воркэраунды. Для воркэраунда оставайтесь в круге узла 6 секунд без урона; выход сбрасывает поиск. После разрешения всех узлов появляется ЦРПТ, его поражение завершает забег победой. Таймер появления босса и обязательное ожидание пяти минут отменены.
