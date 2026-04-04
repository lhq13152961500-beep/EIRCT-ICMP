const listeners = new Set<() => void>();

const store = {
  connectedIds: new Set<string>(),
};

export function connectDevice(id: string) {
  store.connectedIds.add(id);
  listeners.forEach((fn) => fn());
}

export function disconnectDevice(id: string) {
  store.connectedIds.delete(id);
  listeners.forEach((fn) => fn());
}

export function getConnectedIds(): Set<string> {
  return new Set(store.connectedIds);
}

export function subscribeTerminal(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
