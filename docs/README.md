# Документы проекта

## Актуально

- [Запуск и команды](../README.md)
- [Архитектура, ресурсы, сохранения и тесты](../documentation.md)
- [Контракт структуры](STRUCTURE-CONTRACT.md)
- [Противники, баги-минибоссы и цель забега](ENEMIES-AND-NODES.md)
- [Герои, покупки и неоновый стиль](HEROES.md)
- [Оружие, левелап и сохранение забега](WEAPONS-AND-RUN.md)
- [Уровни нагрузки и режим «Продакшен»](DIFFICULTY.md)
- [Открытия, достижения и магазин](META-PROGRESSION.md)
- [Сид, узлы, элиты, предметы, события и вторая карта](RUN-VARIETY.md)
- [Журнал забегов и статистика баланса](RUN-LOG.md)
- [Проверка вёрстки на экранах и устройствах](LAYOUT.md)
- [Таблица лидеров, вход и облачный прогресс — план](FIREBASE-PLAN.md) и [настройка Firebase](FIREBASE-SETUP.md)
- [Фризы при большом числе врагов в Firefox](benchmarks/freeze-investigation.md)
- [Реплики, палитра и очистка прежнего контента](CONTENT-CLEANUP-2026-10-15.md)
- [Исходный аудит 15 октября](PROJECT-AUDIT-2026-10-15.md) — снимок проблем до исправлений
- [Выполненные изменения и проверка](AUDIT-IMPLEMENTATION-2026-10-15.md)
- Что удалено и почему (RETIRED-2026-10-15.md) — в истории git (`git log --diff-filter=D -- docs/archive` находит коммит удаления)

## История

Исторические планы и отчёты (docs/archive: IMPLEMENTATION-PLAN, ACTIVE-ABILITIES-PLAN, PROJECT-STRUCTURE-AUDIT, ART-SOURCES, ADDING-CHARACTERS, CHARACTER-FRAMES, NEW-MAPS, отчёты COMBAT/MICROFREEZE/FRAME/DEPTH/PERFORMANCE, дампы бенчмарков) убраны из дерева на этапе 7 рефакторинга и остаются в истории git (`git log --diff-filter=D -- docs/archive` находит коммит удаления). Это история решений, не инструкции для текущего продукта.

Исходные PNG, промпты и лицензии сохраняются в assets. Старые профили не являются baseline производительности текущей React/Vite-версии. Новые измерения должны указывать commit, сценарий, браузер, устройство и окружение.
