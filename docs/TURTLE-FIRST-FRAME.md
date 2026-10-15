# Первый кадр черепахи

Исправлен только `assets/runtime/characters/enemies/turtle/animations/walk/0.png`. Остальные кадры ожидают согласования первого.

Инструмент: встроенный image_gen. Исходный результат и прежний кадр сохранены в `assets/source/turtle-first-frame/`. Импорт равномерно уменьшает рисунок до исходной высоты 106 px и размещает на прозрачном холсте 256×256 со стопами на строке 235. Скрипт: `tools/import-turtle-first-frame.cjs`.

Финальный запрос после уточнения состава отряда:

```text
Precise correction of this SINGLE game sprite. Keep the entire design, four visible faces, comic proportions, blue/gold shields, dark outlines, green tunics, silver helmets and three-quarter facing-right view. NO animation sheet.
The formation represents SIX soldiers in TWO ROWS OF THREE. Three front soldiers carry THREE upright shields. Three rear soldiers carry THREE roof shields; only the rear-left soldier is partially visible, other two are entirely hidden. Keep visible raised arm of rear-left soldier supporting roof.
Fix ONLY the remaining anatomy and row placement: show TWO distinct legs/sandals belonging to EACH front soldier, SIX front sandals total, with their legs emerging naturally below their respective three front shields. Currently middle-front and right-front have just one foot each; add their missing second lower legs and sandals, slightly behind their leading legs but visibly distinct. The partially visible rear-left soldier belongs BEHIND the first front soldier, not beside him; his one exposed foot may peek out further left/back. Do not add limbs to hidden soldiers, do not add heads or soldiers. Keep roof tightly joined and shields rigid in perspective.
Preserve the original sprite composition: canvas SQUARE, transparent alpha, unit in LOWER PART. Final destination 256x256 with visible unit approximately x64..199,y130..235 and feet grounded at235. Maintain empty top half. Do not enlarge, crop or vertically center the unit. No background, no black fill, no brown fill, no gradients, no shadows, no floor, no writing. This is a correction to existing art, not redesign.
```
