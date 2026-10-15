// Stable in-place filter: keeps order (the simulation is order-sensitive) without
// allocating a new array every frame.
export function compact(list, keep) {
  let n = 0;
  for (let i = 0; i < list.length; i++) {
    const item = list[i];
    if (keep(item)) list[n++] = item;
  }
  list.length = n;
  return list;
}
