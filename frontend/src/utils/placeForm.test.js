import test from 'node:test';
import assert from 'node:assert/strict';

test('place form is populated from a selected place', async () => {
  const module = await import('./placeForm.js').catch(() => ({}));

  assert.equal(typeof module.placeFormFromPlace, 'function');
  assert.deepEqual(
    module.placeFormFromPlace({
      id: 59,
      name: '洪崖洞',
      subtitle: '夜景',
      address: '重庆市',
      lng: '106.5754',
      lat: '29.5569',
      note: '早点去',
      visit_time: null,
      todo: '拍照',
      order_index: '2',
      baidu_uid: 'poi-1'
    }),
    {
      id: 59,
      name: '洪崖洞',
      subtitle: '夜景',
      address: '重庆市',
      lng: 106.5754,
      lat: 29.5569,
      note: '早点去',
      visit_time: '',
      todo: '拍照',
      order_index: 2,
      baidu_uid: 'poi-1',
      version: null
    }
  );
});

test('place form preserves the server version used for optimistic updates', async () => {
  const { placeFormFromPlace } = await import('./placeForm.js');

  assert.equal(
    placeFormFromPlace({
      id: 59,
      name: '洪崖洞',
      lng: 106.5754,
      lat: 29.5569,
      version: '7'
    }).version,
    7
  );
});

test('place payload keeps editable fields and includes a valid server version', async () => {
  const { placePayloadFromForm } = await import('./placeForm.js');

  assert.deepEqual(
    placePayloadFromForm({
      id: 59,
      name: '洪崖洞',
      subtitle: '夜景',
      address: '重庆市',
      lng: 106.5754,
      lat: 29.5569,
      note: '早点去',
      visit_time: '',
      todo: '拍照',
      order_index: 2,
      baidu_uid: 'poi-1',
      version: '7'
    }),
    {
      name: '洪崖洞',
      subtitle: '夜景',
      address: '重庆市',
      lng: 106.5754,
      lat: 29.5569,
      note: '早点去',
      visit_time: '',
      todo: '拍照',
      order_index: 2,
      baidu_uid: 'poi-1',
      version: 7
    }
  );
});
