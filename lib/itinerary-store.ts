export interface PendingRoute {
  ids: string[];
  name: string;
  color: string;
  icon: string;
  imageData?: string | null;
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
