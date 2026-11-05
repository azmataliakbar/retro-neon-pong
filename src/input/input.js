/**
 * Unified input. Keyboard and on-screen touch buttons write into the same held-state,
 * so they combine freely. Taps shorter than one physics step are latched and still
 * move the paddle, so quick presses are never lost.
 */

export const KEY_ACTIONS = Object.freeze({
  KeyW: 'up',
  ArrowUp: 'up',
  KeyS: 'down',
  ArrowDown: 'down',
});

export function createInput({ target = globalThis, touchButtons = [] } = {}) {
  const keys = new Set(); // held KeyboardEvent.code values
  const pointers = new Map(); // pointerId -> action
  const latched = new Set(); // actions pressed since the last consumed step
  const cleanups = [];

  const on = (el, type, fn) => {
    el.addEventListener(type, fn);
    cleanups.push(() => el.removeEventListener(type, fn));
  };

  on(target, 'keydown', (e) => {
    const action = KEY_ACTIONS[e.code];
    if (!action) return;
    e.preventDefault();
    keys.add(e.code);
    if (!e.repeat) latched.add(action);
  });
  on(target, 'keyup', (e) => {
    keys.delete(e.code);
  });
  on(target, 'blur', () => {
    keys.clear();
    pointers.clear();
    latched.clear();
  });

  for (const el of touchButtons) {
    const action = el.dataset.action;
    const press = (e) => {
      if (e.button > 0) return;
      e.preventDefault();
      el.setPointerCapture?.(e.pointerId);
      pointers.set(e.pointerId, action);
      latched.add(action);
      el.classList.add('is-active');
    };
    const release = (e) => {
      pointers.delete(e.pointerId);
      if (![...pointers.values()].includes(action)) el.classList.remove('is-active');
    };
    on(el, 'pointerdown', press);
    on(el, 'pointerup', release);
    on(el, 'pointercancel', release);
    on(el, 'lostpointercapture', release);
    on(el, 'contextmenu', (e) => e.preventDefault());
  }

  function held(action) {
    for (const code of keys) if (KEY_ACTIONS[code] === action) return true;
    for (const a of pointers.values()) if (a === action) return true;
    return false;
  }

  return {
    /** -1 = up, 0 = none (or both held), +1 = down. Consumes latched taps. */
    direction() {
      const up = held('up') || latched.has('up');
      const down = held('down') || latched.has('down');
      latched.clear();
      return (down ? 1 : 0) - (up ? 1 : 0);
    },
    flush() {
      latched.clear();
    },
    destroy() {
      cleanups.splice(0).forEach((fn) => fn());
    },
  };
}
