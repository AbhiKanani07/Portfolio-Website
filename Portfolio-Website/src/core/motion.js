// User motion and pointer preferences, read live so changes apply immediately.
const reduceQuery = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
const fineQuery = typeof matchMedia === 'function' ? matchMedia('(hover: hover) and (pointer: fine)') : null;

export const motion = {
  get reduced() { return !!(reduceQuery && reduceQuery.matches); },
  get finePointer() { return !!(fineQuery && fineQuery.matches); },
  onChange(fn) { reduceQuery && reduceQuery.addEventListener && reduceQuery.addEventListener('change', fn); },
};
