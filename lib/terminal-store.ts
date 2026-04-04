export type ConnectedDevice = {
  id: string;
  name: string;
  type: string;
  location: string;
};

const listeners = new Set<() => void>();

const store: {
  connectedIds: Set<string>;
  connectedDevice: ConnectedDevice | null;
} = {
  connectedIds: new Set(),
  connectedDevice: null,
};

export function connectDevice(device: ConnectedDevice) {
  store.connectedIds.add(device.id);
  store.connectedDevice = device;
  listeners.forEach((fn) => fn());
}

export function disconnectDevice(id: string) {
  store.connectedIds.delete(id);
  if (store.connectedDevice?.id === id) store.connectedDevice = null;
  listeners.forEach((fn) => fn());
}

export function getConnectedIds(): Set<string> {
  return new Set(store.connectedIds);
}

export function getConnectedDevice(): ConnectedDevice | null {
  return store.connectedDevice;
}

export function subscribeTerminal(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
