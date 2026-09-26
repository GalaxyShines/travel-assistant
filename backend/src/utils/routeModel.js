const httpError = require('./httpError');
const { integerOrDefault, requiredText } = require('./normalizers');

function validatePlaceIds(values) {
  if (!Array.isArray(values) || values.length < 2) {
    throw httpError(400, '路线至少需要两个地点');
  }

  const ids = values.map(Number);
  if (ids.some((id) => !Number.isInteger(id) || id <= 0)) {
    throw httpError(400, '路线地点无效');
  }

  if (ids.some((id, index) => index > 0 && id === ids[index - 1])) {
    throw httpError(400, '相邻地点不能相同');
  }

  return ids;
}

function normalizeRouteInput(body, defaults = {}) {
  const name = requiredText(body.name === undefined ? defaults.name : body.name, '路线名称');
  if (Array.from(name).length > 120) {
    throw httpError(400, '路线名称最多 120 字');
  }

  const color = String(
    body.color === undefined ? defaults.color || '#D97706' : body.color
  ).toUpperCase();
  if (!/^#[0-9A-F]{6}$/.test(color)) {
    throw httpError(400, '路线颜色必须是 #RRGGBB 格式');
  }

  const defaultPlaceIds = defaults.placeIds || defaults.place_ids;
  const placeIds = validatePlaceIds(
    body.place_ids === undefined ? defaultPlaceIds : body.place_ids
  );
  const defaultOrderIndex = defaults.orderIndex ?? defaults.order_index ?? 0;
  const orderIndex = integerOrDefault(body.order_index, defaultOrderIndex);
  const version = integerOrDefault(body.version, defaults.version ?? null);

  return {
    name,
    color,
    placeIds,
    orderIndex,
    version
  };
}

function segmentEndpoints(segment) {
  return {
    start: Number(segment.start_place_id ?? segment.from_place_id),
    end: Number(segment.end_place_id ?? segment.to_place_id)
  };
}

function buildLegacyPlaceSequence(segments) {
  if (!Array.isArray(segments) || segments.length === 0) {
    return [];
  }

  const first = segmentEndpoints(segments[0]);
  const placeIds = [first.start, first.end];

  for (let index = 1; index < segments.length; index += 1) {
    const current = segments[index];
    const endpoints = segmentEndpoints(current);
    const expectedStart = placeIds[placeIds.length - 1];

    if (endpoints.start !== expectedStart) {
      placeIds.push(endpoints.start);
    }
    placeIds.push(endpoints.end);
  }

  return validatePlaceIds(placeIds);
}

function collapseAdjacentPlaceIds(placeIds) {
  return placeIds.filter((placeId, index) => index === 0 || placeId !== placeIds[index - 1]);
}

module.exports = {
  buildLegacyPlaceSequence,
  collapseAdjacentPlaceIds,
  normalizeRouteInput,
  validatePlaceIds
};
