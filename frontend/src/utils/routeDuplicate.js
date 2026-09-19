export function hasDuplicateRoute(routes, candidate, excludedRouteId = null) {
  return routes.some(
    (route) =>
      Number(route.id) !== Number(excludedRouteId) &&
      Number(route.from_place_id) === Number(candidate.from_place_id) &&
      Number(route.to_place_id) === Number(candidate.to_place_id)
  );
}
