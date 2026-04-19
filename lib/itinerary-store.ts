export interface PendingRoute {
  ids: string[];
  name: string;
  color: string;
  icon: string;
  savedId?: string;
}

let pendingRoute: PendingRoute | null = null;

export function setPendingCustomRoute(route: PendingRoute) {
  pendingRoute = route;
}

export function getPendingCustomRoute(): PendingRoute | null {
  return pendingRoute;
}

export function clearPendingCustomRoute() {
  pendingRoute = null;
}
