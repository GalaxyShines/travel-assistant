import assert from 'node:assert/strict';
import { test } from 'node:test';

test('route form is populated from a selected route', async () => {
  const module = await import('./routeForm.js').catch(() => ({}));

  assert.equal(typeof module.routeFormFromRoute, 'function');
  assert.deepEqual(
    module.routeFormFromRoute({
      id: 12,
      from_place_id: 3,
      to_place_id: 7,
      travel_mode: 'walking',
      order_index: 4,
      version: null
    }),
    {
      id: 12,
      from_place_id: 3,
      to_place_id: 7,
      travel_mode: 'walking',
      order_index: 4,
      version: null
    }
  );
});

test('route form preserves the server version used for optimistic updates', async () => {
  const { routeFormFromRoute } = await import('./routeForm.js');

  assert.equal(
    routeFormFromRoute({
      id: 12,
      from_place_id: 3,
      to_place_id: 7,
      travel_mode: 'walking',
      order_index: 4,
      version: 9
    }).version,
    9
  );
});

test('route payload keeps only editable fields', async () => {
  const { routePayloadFromForm } = await import('./routeForm.js');

  assert.deepEqual(
    routePayloadFromForm({
      id: 12,
      from_place_id: 3,
      to_place_id: 7,
      travel_mode: 'transit',
      order_index: 4
    }),
    {
      from_place_id: 3,
      to_place_id: 7,
      travel_mode: 'transit',
      order_index: 4
    }
  );
});

test('route payload includes a valid server version when one exists', async () => {
  const { routePayloadFromForm } = await import('./routeForm.js');

  assert.deepEqual(
    routePayloadFromForm({
      id: 12,
      from_place_id: 3,
      to_place_id: 7,
      travel_mode: 'transit',
      order_index: 4,
      version: '9'
    }),
    {
      from_place_id: 3,
      to_place_id: 7,
      travel_mode: 'transit',
      order_index: 4,
      version: 9
    }
  );
});

test('route form can swap start and end places', async () => {
  const { swapRoutePlaces } = await import('./routeForm.js');
  const form = {
    id: 12,
    from_place_id: 3,
    to_place_id: 7,
    travel_mode: 'driving',
    order_index: 4
  };

  swapRoutePlaces(form);

  assert.equal(form.from_place_id, 7);
  assert.equal(form.to_place_id, 3);
});
