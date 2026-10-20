// Plain data with shared objects, as JSON. The running simulation keeps references between its
// objects (a seeker's target, the enemies a shot has hit in a Set, the aura guards): a value is
// written once and later places refer to it, so the copy read back has the same shape and the
// same identities. Sets, Maps, -0, NaN, ±Infinity and undefined survive too.
//   shared object   { $id: n, ...fields }      later  { $ref: n }
//   shared array    { $id: n, $array: [...] }
//   Set / Map       { $set: [...] } / { $map: [[key, value]...] } (with $id when shared)
//   number          { $num: '-0' | 'NaN' | 'Infinity' | '-Infinity' }
//   undefined       { $undefined: 1 }
// Functions and class instances are not plain data: writing them is an error.

const specialNumber = (n) =>
  Object.is(n, -0) ? '-0' : Number.isNaN(n) ? 'NaN' : n > 0 ? 'Infinity' : '-Infinity';
const numbers = { '-0': -0, NaN: NaN, Infinity: Infinity, '-Infinity': -Infinity };
// By tag, not instanceof: the game may run in another realm than the code reading it (tests).
const tag = (value) => Object.prototype.toString.call(value);
const isSet = (value) => tag(value) === '[object Set]';
const isMap = (value) => tag(value) === '[object Map]';
// An object literal of any realm.
const isPlainObject = (value) => {
  const proto = Object.getPrototypeOf(value);
  return proto === null || Object.getPrototypeOf(proto) === null;
};

export function toGraphJson(root) {
  // Pass 1: which objects are reached more than once.
  const seen = new Set(),
    shared = new Set();
  const visit = (value) => {
    if (!value || typeof value !== 'object') return;
    if (seen.has(value)) {
      shared.add(value);
      return;
    }
    seen.add(value);
    if (isSet(value)) for (const item of value) visit(item);
    else if (isMap(value))
      for (const [key, item] of value) {
        visit(key);
        visit(item);
      }
    else for (const key of Object.keys(value)) visit(value[key]);
  };
  visit(root);
  // Pass 2: the first visit writes a shared object with its id, later visits refer to it.
  const ids = new Map();
  const write = (value, path) => {
    if (value === undefined) return { $undefined: 1 };
    if (typeof value === 'number')
      return Number.isFinite(value) && !Object.is(value, -0)
        ? value
        : { $num: specialNumber(value) };
    if (typeof value === 'function' || typeof value === 'symbol' || typeof value === 'bigint')
      throw new Error(`Not plain data at ${path}: ${typeof value}`);
    if (value === null || typeof value !== 'object') return value;
    if (ids.has(value)) return { $ref: ids.get(value) };
    const id = shared.has(value) ? ids.size + 1 : 0;
    if (id) ids.set(value, id);
    const head = id ? { $id: id } : {};
    if (isSet(value))
      return { ...head, $set: [...value].map((item, i) => write(item, `${path}{${i}}`)) };
    if (isMap(value))
      return {
        ...head,
        $map: [...value].map(([key, item], i) => [
          write(key, `${path}<${i}>`),
          write(item, `${path}<${i}>`),
        ]),
      };
    if (Array.isArray(value)) {
      const items = value.map((item, i) => write(item, `${path}[${i}]`));
      return id ? { ...head, $array: items } : items;
    }
    if (!isPlainObject(value))
      throw new Error(
        `Not plain data at ${path}: ${Object.getPrototypeOf(value)?.constructor?.name}`,
      );
    const out = head;
    for (const key of Object.keys(value)) out[key] = write(value[key], `${path}.${key}`);
    return out;
  };
  return write(root, '$');
}

export function fromGraphJson(data) {
  const ids = new Map();
  const read = (value) => {
    if (!value || typeof value !== 'object') return value;
    if (Array.isArray(value)) return value.map(read);
    if ('$ref' in value) {
      if (!ids.has(value.$ref)) throw new Error('Unknown reference ' + value.$ref);
      return ids.get(value.$ref);
    }
    if ('$num' in value) return numbers[value.$num];
    if ('$undefined' in value) return undefined;
    const keep = (made) => {
      if (value.$id) ids.set(value.$id, made);
      return made;
    };
    if ('$set' in value) {
      const set = keep(new Set());
      for (const item of value.$set) set.add(read(item));
      return set;
    }
    if ('$map' in value) {
      const map = keep(new Map());
      for (const [key, item] of value.$map) map.set(read(key), read(item));
      return map;
    }
    if ('$array' in value) {
      const list = keep([]);
      for (const item of value.$array) list.push(read(item));
      return list;
    }
    const out = keep({});
    for (const key of Object.keys(value)) if (key !== '$id') out[key] = read(value[key]);
    return out;
  };
  return read(data);
}
