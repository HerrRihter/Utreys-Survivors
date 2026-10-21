// The five components. Ids are kept as saved (runs and logs refer to them); players see `label`.
export const nodeDefinitions = [
  { id: 'production-aggreagtion', label: 'Агрегация', x: 600, y: 650, bug: 'bug_aggregation' },
  { id: 'code-usage-report', label: 'Отчёт о нанесении', x: 1600, y: 650, bug: 'bug_usage' },
  { id: 'inport-operation-processor', label: 'Импорт', x: 1700, y: 1500, bug: 'bug_import' },
  { id: 'logistic-processor', label: 'Логистика', x: 1100, y: 1800, bug: 'bug_logistic' },
  { id: 'goods-reports', label: 'Товарные отчёты', x: 500, y: 1500, bug: 'bug_goods' },
];
// Toasts after a node's label when it is resolved.
export const nodeToasts = {
  destroyed: ': баг уничтожен',
  closed: ': закрыт',
  workaround: ': воркэраунд найден',
  opened: ': страж побеждён, терминал открыт',
};
export const workaroundSeconds = 6;
export const workaroundRadius = 75;
