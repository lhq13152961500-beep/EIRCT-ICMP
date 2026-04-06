type RoamSession = {
  selectedTime: number;
  people: number;
  arpRouteLevel: number;
};

let _session: RoamSession | null = null;
const _listeners = new Set<() => void>();

export const roamSession = {
  get: (): RoamSession | null => _session,

  start: (s: RoamSession) => {
    _session = s;
    _listeners.forEach(fn => fn());
  },

  stop: () => {
    _session = null;
    _listeners.forEach(fn => fn());
  },

  update: (patch: Partial<RoamSession>) => {
    if (_session) {
      _session = { ..._session, ...patch };
    }
  },

  subscribe: (fn: () => void): (() => void) => {
    _listeners.add(fn);
    return () => _listeners.delete(fn);
  },
};
