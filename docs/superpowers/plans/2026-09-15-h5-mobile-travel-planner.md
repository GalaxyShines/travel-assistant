# H5 旅行规划地图适配 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在不破坏桌面三栏工作区的前提下，为旅行规划地图提供可完整管理计划、标点和路线的手机端 H5 工作区。

**Architecture:** `App.vue` 继续持有认证和服务器数据，将移动导航、地图模式、抽屉和显示偏好拆为明确状态及小组件。`MapView` 仅渲染地图并上报受控事件；路线去重由前端纯函数预检、后端校验和数据库唯一索引三层共同保证。

**Tech Stack:** Vue 3 Composition API、Element Plus、Vite、Node.js test runner、Express 4、mysql2、MySQL。

**Spec:** `docs/superpowers/specs/2026-09-15-h5-mobile-travel-planner-design.md`

## Global Constraints

- 桌面端保留当前三栏工作区，移动端在现有 `760px` 断点下启用四栏底部导航。
- 移动端一级导航必须是“主界面、路线、标点、我的”，且四类已有业务数据共用现有 REST API。
- 普通地图点击不得新增数据；仅 `place-pick` 模式可选空白坐标，`route-pick` 模式只可选标点。
- “显示小标题”和“显示路线”必须分别保存到 `localStorage`，无效缓存必须回退为 `true`。
- 同一计划中同方向 `(from_place_id, to_place_id)` 路线唯一；反向路线允许存在；重复时返回或提示“路线已存在”。
- 不新增前端框架或状态管理依赖；使用 Element Plus 已有的 Dialog、Drawer、Button、Switch、Tabs 和表单组件。
- 当前工作目录不是 Git 仓库；执行时不运行 `git add` 或 `git commit`。

---

## Planned File Structure

- `frontend/src/utils/mapInteraction.js` — 纯地图选点/连线状态转换，不依赖 Vue 或地图 SDK。
- `frontend/src/utils/mapInteraction.test.js` — 地图模式与临时起点的 Node 单元测试。
- `frontend/src/utils/mapPreferences.js` — `localStorage` 显示偏好的安全读写与默认值。
- `frontend/src/utils/mapPreferences.test.js` — 偏好默认值、恢复和损坏值回退测试。
- `frontend/src/utils/routeDuplicate.js` — 纯前端重复路线判断。
- `frontend/src/utils/routeDuplicate.test.js` — 同向、反向、编辑排除自身的测试。
- `frontend/src/components/MobileBottomNav.vue` — H5 四栏底部导航。
- `frontend/src/components/MobileMapControls.vue` — 搜索、显示开关与地图模式按钮。
- `frontend/src/components/MapView.vue` — 受控显示 props、地图模式事件以及移动端不显示传统 InfoWindow 的支持。
- `frontend/src/App.vue` — 组装桌面/移动模板、抽屉/表单、业务动作和响应式状态。
- `frontend/src/styles.css` — H5 安全区、底部导航、全屏地图、抽屉和列表的触控布局；保留桌面规则。
- `frontend/package.json` — 添加 `test` 脚本。
- `backend/database/schema.sql` — 新数据库的路线方向唯一索引。
- `backend/scripts/init-db.js` — 已存在数据库的唯一索引检查与迁移。
- `backend/src/routes/routes.js` — POST/PUT 的重复路线校验及数据库重复键映射。

## Task 1: Add Testable Mobile Interaction and Preference Utilities

**Files:**
- Create: `frontend/src/utils/mapInteraction.js`
- Create: `frontend/src/utils/mapInteraction.test.js`
- Create: `frontend/src/utils/mapPreferences.js`
- Create: `frontend/src/utils/mapPreferences.test.js`
- Create: `frontend/src/utils/routeDuplicate.js`
- Create: `frontend/src/utils/routeDuplicate.test.js`
- Modify: `frontend/package.json`

**Interfaces:**
- Produces `MAP_INTERACTION_MODES`, `toggleInteractionMode(currentMode, requestedMode)`, `pickRouteEndpoint(startPlaceId, placeId)`, and `clearInteraction()`.
- Produces `loadMapDisplayPreferences(storage)` and `saveMapDisplayPreferences(preferences, storage)`, where `preferences` is `{ showPlaceLabels: boolean, showRoutes: boolean }`.
- Produces `hasDuplicateRoute(routes, candidate, excludedRouteId = null)`, where `candidate` contains numeric or string `from_place_id` and `to_place_id`.
- `App.vue` consumes these helpers; no helper may read Vue refs directly.

- [ ] **Step 1: Write failing interaction-state tests**

```js
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MAP_INTERACTION_MODES, pickRouteEndpoint, toggleInteractionMode } from './mapInteraction.js';

test('route picking records a start then completes with an end', () => {
  assert.equal(toggleInteractionMode('browse', MAP_INTERACTION_MODES.ROUTE_PICK), MAP_INTERACTION_MODES.ROUTE_PICK);
  assert.deepEqual(pickRouteEndpoint(null, 4), { startPlaceId: 4, endPlaceId: null, complete: false });
  assert.deepEqual(pickRouteEndpoint(4, 9), { startPlaceId: 4, endPlaceId: 9, complete: true });
});
```

- [ ] **Step 2: Run the interaction test to verify it fails**

Run: `pnpm exec node --test src/utils/mapInteraction.test.js`

Expected: FAIL because `mapInteraction.js` does not exist.

- [ ] **Step 3: Implement the minimal pure interaction module**

```js
export const MAP_INTERACTION_MODES = Object.freeze({
  BROWSE: 'browse',
  PLACE_PICK: 'place-pick',
  ROUTE_PICK: 'route-pick'
});

export function toggleInteractionMode(currentMode, requestedMode) {
  return currentMode === requestedMode ? MAP_INTERACTION_MODES.BROWSE : requestedMode;
}

export function pickRouteEndpoint(startPlaceId, placeId) {
  return startPlaceId === null
    ? { startPlaceId: placeId, endPlaceId: null, complete: false }
    : { startPlaceId, endPlaceId: placeId, complete: true };
}
```

`pickRouteEndpoint` must return a non-complete result for a repeated click on the same point so `App.vue` can display “起点和终点不能相同” without opening the confirmation drawer.

- [ ] **Step 4: Add and run preference and duplicate-route tests**

```js
test('invalid stored display preferences use visible defaults', () => {
  const storage = { getItem: () => '{invalid-json' };
  assert.deepEqual(loadMapDisplayPreferences(storage), { showPlaceLabels: true, showRoutes: true });
});

test('only a same-direction route is a duplicate', () => {
  const routes = [{ id: 1, from_place_id: 2, to_place_id: 3 }];
  assert.equal(hasDuplicateRoute(routes, { from_place_id: 2, to_place_id: 3 }), true);
  assert.equal(hasDuplicateRoute(routes, { from_place_id: 3, to_place_id: 2 }), false);
});
```

Run: `pnpm exec node --test src/utils/mapInteraction.test.js src/utils/mapPreferences.test.js src/utils/routeDuplicate.test.js`

Expected: FAIL until the two modules are added.

- [ ] **Step 5: Implement storage and route duplicate helpers**

Use `travel-helper-map-display-preferences` as the single storage key. Validate that each decoded property is exactly a boolean; apply `true` for each missing, invalid, or non-object value. Implement duplicate comparison with `Number()` and ignore a record whose `id` equals `excludedRouteId`; this allows a route form to save unchanged endpoints.

- [ ] **Step 6: Add the test script and verify all utility tests pass**

Add this script without changing build behavior:

```json
"test": "node --test"
```

Run: `pnpm test`

Expected: PASS for existing `src/utils/*.test.js` plus the three new suites.

## Task 2: Enforce Directional Route Uniqueness in the API and Database

**Files:**
- Modify: `backend/database/schema.sql:39-64`
- Modify: `backend/scripts/init-db.js:28-53`
- Modify: `backend/src/routes/routes.js:17-142`

**Interfaces:**
- POST `/api/trips/:tripId/routes` and PUT `/api/routes/:id` return HTTP 409 with `{ message: '路线已存在' }` for an existing same-direction route.
- The routes table owns a unique index named `uq_routes_trip_direction` over `(trip_id, from_place_id, to_place_id)`.
- `ensureUniqueRouteDirection(tripId, fromPlaceId, toPlaceId, excludedRouteId = null)` is called after `ensurePlacesBelongToTrip` and before every route insert/update.

- [ ] **Step 1: Add the schema-level invariant**

Within the `routes` table definition, add:

```sql
UNIQUE KEY `uq_routes_trip_direction` (`trip_id`, `from_place_id`, `to_place_id`),
```

Place it next to the existing route indexes. It deliberately excludes `travel_mode`, because the product treats the directed connection itself as unique.

- [ ] **Step 2: Make `init-db` migrate existing databases safely**

Add `ensureRouteDirectionUniqueIndex(connection, databaseName)` after `ensurePlaceSubtitleColumn`. It must query `INFORMATION_SCHEMA.STATISTICS` for `INDEX_NAME = 'uq_routes_trip_direction'`; if missing, query duplicate groups with:

```sql
SELECT trip_id, from_place_id, to_place_id, COUNT(*) AS count
FROM routes
GROUP BY trip_id, from_place_id, to_place_id
HAVING COUNT(*) > 1
```

If rows exist, throw an Error that names the duplicate condition and asks the operator to clean duplicate routes before rerunning `pnpm run init-db`; do not silently delete user routes. Otherwise execute `ALTER TABLE \`<databaseName>\`.\`routes\` ADD UNIQUE KEY \`uq_routes_trip_direction\` (\`trip_id\`, \`from_place_id\`, \`to_place_id\`)`.

- [ ] **Step 3: Add the server-side pre-check**

In `routes.js`, create a helper that tests same-direction existence and excludes the current route during PUT:

```js
async function ensureUniqueRouteDirection(tripId, fromPlaceId, toPlaceId, excludedRouteId = null) {
  const params = [tripId, fromPlaceId, toPlaceId];
  let sql = 'SELECT id FROM routes WHERE trip_id = ? AND from_place_id = ? AND to_place_id = ?';
  if (excludedRouteId !== null) {
    sql += ' AND id != ?';
    params.push(excludedRouteId);
  }
  const [rows] = await pool.execute(sql, params);
  if (rows.length > 0) throw httpError(409, '路线已存在');
}
```

Call it in POST and PUT after ownership validation. Wrap only the `pool.execute` write path in a `try/catch`; map MySQL `ER_DUP_ENTRY` to `httpError(409, '路线已存在')`, then rethrow other errors.

- [ ] **Step 4: Verify syntax and migration behavior**

Run: `node --check src/routes/routes.js`

Expected: exit code 0.

Run: `pnpm run init-db`

Expected: a fresh or already-migrated local database completes successfully. If the database reports existing duplicate groups, stop and report their identifiers rather than altering or deleting data.

## Task 3: Make MapView a Controlled H5 Map Surface

**Files:**
- Modify: `frontend/src/components/MapView.vue:33-48,153-225,237-245,327-351`
- Modify: `frontend/src/utils/mapEvents.test.js`

**Interfaces:**
- New props: `showPlaceLabels` (default `true`), `showRoutes` (default `true`), `interactionMode` (default `'browse'`), `routeStartPlaceId` (default `null`), and `showInfoWindows` (default `true`).
- New emits: `route-place-picked`, `route-selected`, and `map-availability-changed` in addition to existing `map-click` and `place-selected`.
- In `place-pick`, map background click emits coordinates; in `browse` and `route-pick` it emits no creation event. In `route-pick`, marker click emits `route-place-picked` and never opens an InfoWindow.

- [ ] **Step 1: Extend the marker-event test first**

Add an exported pure predicate `shouldHandleMapBackgroundClick(mode)` in `mapEvents.js` and test:

```js
assert.equal(shouldHandleMapBackgroundClick('place-pick'), true);
assert.equal(shouldHandleMapBackgroundClick('browse'), false);
assert.equal(shouldHandleMapBackgroundClick('route-pick'), false);
```

Run: `pnpm exec node --test src/utils/mapEvents.test.js`

Expected: FAIL until the predicate is added.

- [ ] **Step 2: Implement the predicate and pass its test**

```js
export function shouldHandleMapBackgroundClick(mode) {
  return mode === 'place-pick';
}
```

Run: `pnpm exec node --test src/utils/mapEvents.test.js`

Expected: PASS.

- [ ] **Step 3: Add controlled rendering props and events to MapView**

Update `renderMarkers()` so labels are built only when `showPlaceLabels` is true, except that a route-pick start marker can carry a concise selected state label. Update `renderPolylines()` to clear existing overlays and return early when `showRoutes` is false. Include these props in the existing deep watch source so a switch redraws immediately.

In marker click handling: stop propagation first; when `interactionMode === 'route-pick'`, emit `route-place-picked` and return. Otherwise emit `place-selected`, and call `openPlaceInfo` only if `showInfoWindows` is true. Emit `route-selected` before opening a route InfoWindow. Map background click must call `shouldHandleMapBackgroundClick(interactionMode)` before emitting `map-click`.

- [ ] **Step 4: Report map availability without changing existing error UI**

After successful initialization emit `map-availability-changed` with `true`; in the `catch` block set the existing error text and emit `map-availability-changed` with `false`. Preserve the existing in-map unavailable message and `focusPlace` / `searchPlaces` exposure.

- [ ] **Step 5: Build the frontend**

Run: `pnpm build`

Expected: Vite build completes with no Vue template, prop, or import errors.

## Task 4: Assemble the Mobile Navigation, Drawers, and Business Flows

**Files:**
- Create: `frontend/src/components/MobileBottomNav.vue`
- Create: `frontend/src/components/MobileMapControls.vue`
- Modify: `frontend/src/App.vue:20-323,326-934`

**Interfaces:**
- `MobileBottomNav` accepts `activePage` in `'map' | 'routes' | 'places' | 'profile'` and emits `change(page)`.
- `MobileMapControls` accepts `searchKeyword`, `showPlaceLabels`, `showRoutes`, `interactionMode`, `mapAvailable`, `hasTrip`, and `placeCount`; emits `update:searchKeyword`, `search`, `update:showPlaceLabels`, `update:showRoutes`, `toggle-place-pick`, and `toggle-route-pick`.
- `App.vue` owns `mobilePage`, `mobileOverlay`, `interactionMode`, `routePickStartPlaceId`, `mapDisplayPreferences`, and `isMapAvailable`.

- [ ] **Step 1: Create the four-item navigation component**

Render four real `<button type="button">` elements, each with an Element Plus icon and Chinese text. Apply `aria-current="page"` only to the active button and emit exactly one of `map`, `routes`, `places`, `profile` on click. Do not embed route, place, or plan logic in this component.

- [ ] **Step 2: Create controlled map controls**

Render the search input plus two `el-switch` controls labelled “显示小标题” and “显示路线”. Add distinct buttons labelled “地图选点” and “选点连线”. Disable both mode buttons when `!hasTrip || !mapAvailable`; disable route selection when `placeCount < 2`. Emit only events; do not mutate props.

- [ ] **Step 3: Add App-level mobile state and persistence**

On module initialization, call `loadMapDisplayPreferences(window.localStorage)` behind a `typeof window !== 'undefined'` guard. Watch `showPlaceLabels` and `showRoutes` and call `saveMapDisplayPreferences` after either change. Define:

```js
const mobilePage = ref('map');
const mobileOverlay = ref(null); // 'search-results' | 'place-detail' | 'place-form' | 'route-form' | null
const interactionMode = ref(MAP_INTERACTION_MODES.BROWSE);
const routePickStartPlaceId = ref(null);
```

`exitMapInteraction()` must reset both `interactionMode` and `routePickStartPlaceId`; call it after plan changes, logout, map selection save/cancel, and when an overlay closes.

- [ ] **Step 4: Wire safe map selection behavior**

Replace unconditional `handleMapClick` behavior with a guard for `PLACE_PICK`. It must prefill the current place form, set `mobileOverlay` to `place-form`, and leave creation to the existing `savePlace` call. Add `handleRoutePlacePicked(place)` that records the first point, rejects the same second point, checks `hasDuplicateRoute(routes.value, candidate)`, and otherwise populates a new route form then opens `route-form`. It must not call the API before the confirmation form is saved.

When `saveRoute` is called, repeat `hasDuplicateRoute(routes.value, routeForm, routeForm.id)` before the API request and show `ElMessage.warning('路线已存在')` on duplication. The API's 409 remains the final fallback.

- [ ] **Step 5: Add H5 page and overlay templates while preserving the desktop template**

Keep the current header/workspace in a `desktop-shell` wrapper. Add a sibling `mobile-shell` wrapper with:

1. A compact current-plan header and map page that contains `MapView`, `MobileMapControls`, and the two mode buttons.
2. A routes page reusing `sortedRoutes`, `startNewRoute`, `selectRoute`, `deleteRoute`, and `navigateRoute`.
3. A places page reusing `sortedPlaces`, `startManualPlace`, `selectPlace`, `deletePlace`, and `navigateFromPlace`.
4. A profile page reusing `trips`, `selectTrip`, `openTripDialog`, `deleteCurrentTrip`, `loadTrips`, and `logout`.
5. `el-drawer` overlays for place detail and small confirmation content; full-screen `el-dialog` or `el-drawer` forms for all existing place and route fields; a full-screen search-results drawer with back/close action.

On a mobile marker click, set the selected place and open the place-detail drawer. On desktop, preserve InfoWindow controls. Pass `:show-info-windows="!isMobileViewport"` to `MapView`.

- [ ] **Step 6: Keep legacy flows correct across layouts**

`selectPlace`, `selectRoute`, search result addition, manual creation, auto-generation, deletion, and plan switching must set the appropriate mobile page/overlay only when `isMobileViewport` is true; desktop must continue updating `activeTab`. Add a small `useMediaQuery`-style `matchMedia('(max-width: 760px)')` listener in `App.vue`, clean it up in `onBeforeUnmount`, and use it to select the correct layout and map InfoWindow behavior.

- [ ] **Step 7: Build after assembling the flows**

Run: `pnpm test && pnpm build`

Expected: all utility tests pass and Vite produces `dist/`.

## Task 5: Add Mobile-First Styling Without Regressing Desktop

**Files:**
- Modify: `frontend/src/styles.css:1-278`

**Interfaces:**
- `.desktop-shell` is visible above 760px and `.mobile-shell` is visible at or below 760px.
- The mobile map has viewport height minus top bar, controls, and bottom navigation; the bottom navigation always respects `env(safe-area-inset-bottom)`.
- All mobile interactive targets have a minimum 44px hit area.

- [ ] **Step 1: Add base layout isolation**

Add desktop/mobile visibility rules outside the media query, then switch them in the `max-width: 760px` block. Do not use `display: none` on the mounted `MapView` that owns a live map while navigating mobile subpages; keep it mounted within the mobile shell and use page panels/overlays above it.

- [ ] **Step 2: Style the mobile shell and safe navigation**

Add a fixed mobile bottom bar with `padding-bottom: max(10px, env(safe-area-inset-bottom))`, a visible active color, and a top border. Add corresponding bottom padding to the mobile content so no list row or map control sits under the bar. Give map mode buttons activated by `place-pick` and `route-pick` distinct background/border states and a textual cancel action.

- [ ] **Step 3: Make small-screen editing and lists usable**

Set mobile drawers/dialog panels to full width, convert form grids and travel-mode controls to one column at small widths, allow action rows to wrap, and preserve existing ellipsis behavior for long location names. Ensure Element Plus controls do not overflow horizontally at 320px.

- [ ] **Step 4: Inspect desktop and mobile rendering**

Run: `pnpm build`

Then use a browser at approximately 1440px, 768px, and 375px widths. Verify the desktop header/workspace remains present at 1440px; at 375px, verify the bottom navigation, main map, search, both display switches, both selection modes, form overlay, and page lists fit without horizontal scrolling.

## Task 6: End-to-End Regression Verification and Documentation

**Files:**
- Modify: `README.md` (add a concise “H5 使用方式” subsection after the frontend description)

**Interfaces:**
- README names the four mobile tabs, the two deliberate map modes, local display preference behavior, and the one-time database initializer needed for the new unique index.

- [ ] **Step 1: Document concrete H5 operation paths**

Document these exact paths: search then add a POI; click “地图选点” then tap map then save; click “选点连线” then select two markers then save; toggle the two map display switches; manage a plan under “我的”. State that same-direction duplicate routes are rejected with “路线已存在”.

- [ ] **Step 2: Run automated checks**

Run in `frontend`: `pnpm test && pnpm build`

Run in `backend`: `node --check src/routes/routes.js && pnpm run init-db`

Expected: all commands exit 0, unless the initializer intentionally reports pre-existing duplicate groups that require manual user data cleanup.

- [ ] **Step 3: Perform manual functional verification**

With the frontend and backend running, verify all of the following at 375px wide: login; plan switch; map display preferences survive refresh; ordinary map click does nothing; place-pick adds a location; route-pick creates one route and rejects an identical second route; reverse direction remains creatable; search result adds a location; route/place edit and delete work; “我的” can create/edit/delete a plan; and a Baidu navigation link opens. Repeat a smoke check at desktop width for existing three-column search, place form, route form, and InfoWindow actions.

- [ ] **Step 4: Record verification results in the delivery summary**

State exact command outputs, any environment-specific limitation such as unavailable Baidu Map AK or local MySQL, and the concrete files changed. Do not claim mobile map interaction is verified if the map SDK could not initialize.
