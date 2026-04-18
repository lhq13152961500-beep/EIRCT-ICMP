let pendingCustomRouteIds: string[] | null = null;

export function setPendingCustomRoute(ids: string[]) {
  pendingCustomRouteIds = ids;
}

export function getPendingCustomRoute(): string[] | null {
  return pendingCustomRouteIds;
}

export function clearPendingCustomRoute() {
  pendingCustomRouteIds = null;
}
