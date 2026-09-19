export function createEmptyPlaceForm() {
  return {
    id: null,
    name: '',
    subtitle: '',
    address: '',
    lng: null,
    lat: null,
    note: '',
    visit_time: '',
    todo: '',
    order_index: 0,
    baidu_uid: '',
    version: null
  };
}

export function placeFormFromPlace(place) {
  return {
    id: place.id,
    name: place.name || '',
    subtitle: place.subtitle || '',
    address: place.address || '',
    lng: Number(place.lng),
    lat: Number(place.lat),
    note: place.note || '',
    visit_time: place.visit_time || '',
    todo: place.todo || '',
    order_index: Number(place.order_index || 0),
    baidu_uid: place.baidu_uid || '',
    version: place.version === undefined || place.version === null ? null : Number(place.version)
  };
}

export function placePayloadFromForm(form) {
  const payload = {
    name: form.name,
    subtitle: form.subtitle,
    address: form.address,
    lng: form.lng,
    lat: form.lat,
    note: form.note,
    visit_time: form.visit_time,
    todo: form.todo,
    order_index: form.order_index,
    baidu_uid: form.baidu_uid
  };

  if (Number.isInteger(Number(form.version))) {
    payload.version = Number(form.version);
  }

  return payload;
}
