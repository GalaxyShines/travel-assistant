<template>
  <div class="map-shell">
    <div ref="mapElement" class="map-container"></div>
    <el-tooltip content="显示所有标点" placement="left">
      <el-button
        class="map-fit-button"
        :icon="Aim"
        circle
        :disabled="places.length === 0"
        aria-label="显示所有标点"
        @click.stop="fitViewport"
      />
    </el-tooltip>
    <div v-if="mapError" class="map-status">
      <el-icon><Warning /></el-icon>
      <div>
        <strong>地图暂不可用</strong>
        <p>{{ mapError }}</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { Aim, Warning } from '@element-plus/icons-vue';
import { appConfig } from '../config';
import { loadBaiduMap } from '../utils/mapLoader';
import { shouldHandleMapBackgroundClick, stopMapClickPropagation } from '../utils/mapEvents';
import { syncMapViewport } from '../utils/mapResize';
import { shouldFitViewportAfterRender } from '../utils/mapViewport';
import {
  assignSharedSegmentSlots,
  buildPlaceBadges,
  contrastTextColor,
  expandRouteSegments,
  offsetSegmentPixels
} from '../utils/routeMap';

const props = defineProps({
  places: { type: Array, default: () => [] },
  routes: { type: Array, default: () => [] },
  visibleRouteIds: { type: [Array, Set], default: null },
  selectedRouteId: { type: [Number, String], default: null },
  draftRoute: { type: Object, default: null },
  selectedPlaceId: { type: [Number, String], default: null },
  showPlaceLabels: { type: Boolean, default: true },
  interactionMode: { type: String, default: 'browse' },
  showInfoWindows: { type: Boolean, default: true },
  isVisible: { type: Boolean, default: true }
});

const emit = defineEmits(['map-click', 'place-selected', 'route-selected', 'map-availability-changed']);
const mapElement = ref(null);
const mapError = ref('');

let BMap = null;
let map = null;
let markers = [];
let routeLines = [];
let routeHalos = [];
let routeBadgeLabels = [];
let resizeObserver = null;
let resizeFrameId = null;
let routeFrameId = null;

function validColor(color) {
  return /^#[0-9A-F]{6}$/i.test(color || '') ? color.toUpperCase() : '#D97706';
}

function scheduleMapViewportSync() {
  if (!map || resizeFrameId !== null) return;
  resizeFrameId = window.requestAnimationFrame(() => {
    resizeFrameId = null;
    syncMapViewport(map, renderAll);
  });
}

function scheduleRouteOverlayRender() {
  if (!map || routeFrameId !== null) return;
  routeFrameId = window.requestAnimationFrame(() => {
    routeFrameId = null;
    renderRouteOverlays();
  });
}

function observeMapViewport() {
  if (typeof ResizeObserver !== 'undefined' && mapElement.value) {
    resizeObserver = new ResizeObserver(scheduleMapViewportSync);
    resizeObserver.observe(mapElement.value);
  }
  window.addEventListener('resize', scheduleMapViewportSync);
  window.visualViewport?.addEventListener('resize', scheduleMapViewportSync);
}

function stopObservingMapViewport() {
  resizeObserver?.disconnect();
  resizeObserver = null;
  window.removeEventListener('resize', scheduleMapViewportSync);
  window.visualViewport?.removeEventListener('resize', scheduleMapViewportSync);
  if (resizeFrameId !== null) window.cancelAnimationFrame(resizeFrameId);
  if (routeFrameId !== null) window.cancelAnimationFrame(routeFrameId);
  resizeFrameId = null;
  routeFrameId = null;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function toPoint(lng, lat) {
  return new BMap.Point(Number(lng), Number(lat));
}

function placePoint(place) {
  return toPoint(place.lng, place.lat);
}

function clearOverlays(overlays) {
  overlays.forEach((overlay) => map?.removeOverlay(overlay));
  overlays.length = 0;
}

function buildPlaceInfoHtml(place) {
  return `
    <div class="map-info">
      <h3>${escapeHtml(place.name)}</h3>
      ${place.subtitle ? `<p>${escapeHtml(place.subtitle)}</p>` : ''}
      <p>${escapeHtml(place.address || '暂无地址')}</p>
      <dl>
        <dt>计划时间</dt><dd>${escapeHtml(place.visit_time || '未设置')}</dd>
        <dt>备注</dt><dd>${escapeHtml(place.note || '无')}</dd>
        <dt>要做的事</dt><dd>${escapeHtml(place.todo || '无')}</dd>
      </dl>
      <div class="map-info-actions">
        <button onclick="window.travelMapActions?.editPlace(${Number(place.id)})">编辑</button>
        <button onclick="window.travelMapActions?.goToPlace(${Number(place.id)})">去这里</button>
        <button class="danger" onclick="window.travelMapActions?.deletePlace(${Number(place.id)})">删除</button>
      </div>
    </div>
  `;
}

function buildRouteInfoHtml(route) {
  const color = validColor(route.color);
  return `
    <div class="map-info">
      <h3>${escapeHtml(route.name)}</h3>
      <p><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${color};margin-right:6px"></span>${Number(route.stops?.length || 0)} 个地点</p>
      <div class="map-info-actions">
        <button onclick="window.travelMapActions?.editRoute(${Number(route.id)})">编辑路线</button>
      </div>
    </div>
  `;
}

function openPlaceInfo(place) {
  const infoWindow = new BMap.InfoWindow(buildPlaceInfoHtml(place), {
    width: 300,
    enableMessage: false
  });
  map.openInfoWindow(infoWindow, placePoint(place));
}

function openRouteInfo(route, point) {
  const infoWindow = new BMap.InfoWindow(buildRouteInfoHtml(route), {
    width: 300,
    enableMessage: false
  });
  map.openInfoWindow(infoWindow, point);
}

function fitViewport() {
  if (!map || props.places.length === 0) return;
  const points = props.places.map(placePoint);
  if (points.length === 1) {
    map.centerAndZoom(points[0], 15);
    return;
  }
  map.setViewport(points, { margins: [56, 56, 56, 56] });
}

function renderMarkers() {
  clearOverlays(markers);
  props.places.forEach((place) => {
    const marker = new BMap.Marker(placePoint(place), { title: place.name });
    marker.addEventListener('click', (event) => {
      stopMapClickPropagation(event);
      emit('place-selected', place);
      if (props.showInfoWindows) openPlaceInfo(place);
    });
    map.addOverlay(marker);
    markers.push(marker);
  });
}

function savedVisibleRoutes() {
  if (props.visibleRouteIds === null) return props.routes;
  const visibleIds = new Set([...props.visibleRouteIds].map(Number));
  return props.routes.filter((route) => visibleIds.has(Number(route.id)));
}

function draftAsRoute() {
  if (!props.draftRoute?.placeIds?.length) return null;
  const placeById = new Map(props.places.map((place) => [Number(place.id), place]));
  const stops = props.draftRoute.placeIds.map((placeId, index) => {
    const place = placeById.get(Number(placeId));
    return place ? { ...place, place_id: Number(placeId), stop_index: index + 1 } : null;
  }).filter(Boolean);
  return {
    id: -1,
    name: props.draftRoute.name || '路线草稿',
    color: validColor(props.draftRoute.color),
    order_index: Number.MAX_SAFE_INTEGER,
    stops,
    draft: true
  };
}

function routeRenderData() {
  const routes = [...savedVisibleRoutes()];
  const draft = draftAsRoute();
  if (draft) routes.push(draft);
  return routes;
}

function createArrow(color) {
  if (!BMap.IconSequence || !BMap.Symbol || !window.BMap_Symbol_SHAPE_FORWARD_CLOSED_ARROW) {
    return [];
  }
  return [new BMap.IconSequence(
    new BMap.Symbol(window.BMap_Symbol_SHAPE_FORWARD_CLOSED_ARROW, {
      scale: 0.7,
      strokeColor: color,
      fillColor: color,
      fillOpacity: 1
    }),
    '50%',
    '0',
    false
  )];
}

function renderRouteLines(routes) {
  const routesById = new Map(routes.map((route) => [Number(route.id), route]));
  const segments = assignSharedSegmentSlots(expandRouteSegments(routes));
  segments.forEach((segment) => {
    const route = routesById.get(segment.routeId);
    const color = validColor(segment.color);
    const rawFrom = toPoint(segment.from.lng, segment.from.lat);
    const rawTo = toPoint(segment.to.lng, segment.to.lat);
    const offset = offsetSegmentPixels(
      map.pointToPixel(rawFrom),
      map.pointToPixel(rawTo),
      segment.directedSlot,
      8
    );
    const fromPoint = map.pixelToPoint(new BMap.Pixel(offset.from.x, offset.from.y));
    const toPointValue = map.pixelToPoint(new BMap.Pixel(offset.to.x, offset.to.y));
    const selected = Number(props.selectedRouteId) === segment.routeId;
    const isDraft = segment.routeId === -1;
    const halo = new BMap.Polyline([fromPoint, toPointValue], {
      strokeColor: '#FFFFFF',
      strokeWeight: selected ? 10 : 8,
      strokeOpacity: 0.92,
      strokeStyle: isDraft ? 'dashed' : 'solid'
    });
    const line = new BMap.Polyline([fromPoint, toPointValue], {
      strokeColor: color,
      strokeWeight: selected ? 6 : 4,
      strokeOpacity: isDraft ? 0.7 : 0.92,
      strokeStyle: isDraft ? 'dashed' : 'solid',
      icons: createArrow(color)
    });

    if (!isDraft) {
      line.addEventListener('click', (event) => {
        stopMapClickPropagation(event);
        emit('route-selected', route);
        if (props.showInfoWindows) {
          openRouteInfo(route, event.point || map.pixelToPoint(new BMap.Pixel(
            (offset.from.x + offset.to.x) / 2,
            (offset.from.y + offset.to.y) / 2
          )));
        }
      });
    }
    map.addOverlay(halo);
    map.addOverlay(line);
    routeHalos.push(halo);
    routeLines.push(line);
  });
}

function badgeElement(badge) {
  const element = document.createElement('span');
  const color = validColor(badge.color);
  element.className = `map-route-badge${badge.routeId === -1 ? ' draft' : ''}`;
  element.textContent = String(badge.number);
  element.style.backgroundColor = color;
  element.style.color = contrastTextColor(color);
  element.title = `路线第 ${badge.number} 站`;
  return element;
}

function addBadgeOverlay(place, badges) {
  const container = document.createElement('div');
  container.className = 'map-route-place-label';
  const badgeRow = document.createElement('div');
  badgeRow.className = 'map-route-badges';
  badges.forEach((badge) => badgeRow.appendChild(badgeElement(badge)));
  if (badges.length) container.appendChild(badgeRow);

  const captions = [];
  if (props.showPlaceLabels && place.subtitle) captions.push(place.subtitle);
  if (Number(place.id) === Number(props.selectedPlaceId)) captions.push('当前');
  if (captions.length) {
    const caption = document.createElement('span');
    caption.className = 'map-route-place-caption';
    caption.textContent = captions.join(' · ');
    container.appendChild(caption);
  }
  if (!container.childNodes.length) return;

  function RouteBadgeOverlay(point, element) {
    this.point = point;
    this.element = element;
  }
  RouteBadgeOverlay.prototype = new BMap.Overlay();
  RouteBadgeOverlay.prototype.initialize = function initialize(mapInstance) {
    this.map = mapInstance;
    mapInstance.getPanes().labelPane.appendChild(this.element);
    return this.element;
  };
  RouteBadgeOverlay.prototype.draw = function draw() {
    const pixel = this.map.pointToOverlayPixel(this.point);
    this.element.style.left = `${pixel.x}px`;
    this.element.style.top = `${pixel.y}px`;
  };

  const overlay = new RouteBadgeOverlay(placePoint(place), container);
  map.addOverlay(overlay);
  routeBadgeLabels.push(overlay);
}

function renderRouteBadges(routes) {
  const badgesByPlace = buildPlaceBadges(routes);
  props.places.forEach((place) => addBadgeOverlay(
    place,
    badgesByPlace.get(Number(place.id)) || []
  ));
}

function renderRouteOverlays() {
  if (!map) return;
  clearOverlays(routeLines);
  clearOverlays(routeHalos);
  clearOverlays(routeBadgeLabels);
  const routes = routeRenderData();
  renderRouteLines(routes);
  renderRouteBadges(routes);
}

function renderAll(options = {}) {
  if (!map) return;
  renderMarkers();
  renderRouteOverlays();
  if (shouldFitViewportAfterRender(options)) nextTick(fitViewport);
}

async function initMap() {
  try {
    BMap = await loadBaiduMap(appConfig.baiduMapAk);
    map = new BMap.Map(mapElement.value);
    map.centerAndZoom(new BMap.Point(105.404, 35.915), 5);
    map.enableScrollWheelZoom(true);
    map.addControl(new BMap.NavigationControl());
    map.addControl(new BMap.ScaleControl());
    map.addEventListener('click', (event) => {
      if (!event.point || !shouldHandleMapBackgroundClick(props.interactionMode)) return;
      emit('map-click', {
        lng: Number(event.point.lng.toFixed(7)),
        lat: Number(event.point.lat.toFixed(7))
      });
    });
    map.addEventListener('zoomend', scheduleRouteOverlayRender);
    map.addEventListener('moveend', scheduleRouteOverlayRender);
    renderAll({ fitViewport: true });
    observeMapViewport();
    nextTick(scheduleMapViewportSync);
    emit('map-availability-changed', true);
  } catch (error) {
    mapError.value = error.message;
    emit('map-availability-changed', false);
  }
}

function focusPlace(placeId) {
  const place = props.places.find((item) => Number(item.id) === Number(placeId));
  if (!map || !place) return;
  const point = placePoint(place);
  map.panTo(point);
  map.setZoom(Math.max(map.getZoom(), 15));
  if (props.showInfoWindows) openPlaceInfo(place);
}

async function searchPlaces(keyword) {
  if (!map || !BMap) throw new Error(mapError.value || '地图尚未初始化完成');
  const trimmedKeyword = keyword.trim();
  if (!trimmedKeyword) return [];
  return new Promise((resolve, reject) => {
    const localSearch = new BMap.LocalSearch(map, {
      onSearchComplete: (searchResult) => {
        const status = localSearch.getStatus?.();
        if (typeof window.BMAP_STATUS_SUCCESS !== 'undefined' && status !== window.BMAP_STATUS_SUCCESS) {
          resolve([]);
          return;
        }
        const results = [];
        const resultSets = Array.isArray(searchResult) ? searchResult : [searchResult];
        resultSets.forEach((resultSet) => {
          if (!resultSet) return;
          const count = typeof resultSet.getCurrentNumPois === 'function'
            ? resultSet.getCurrentNumPois()
            : typeof resultSet.getNumPois === 'function' ? resultSet.getNumPois() : 0;
          for (let index = 0; index < count; index += 1) {
            const poi = resultSet.getPoi(index);
            if (!poi?.point) continue;
            results.push({
              name: poi.title,
              address: poi.address || [poi.province, poi.city].filter(Boolean).join(' '),
              lng: Number(poi.point.lng.toFixed(7)),
              lat: Number(poi.point.lat.toFixed(7)),
              baidu_uid: poi.uid || ''
            });
          }
        });
        resolve(results);
      }
    });
    try {
      localSearch.search(trimmedKeyword);
    } catch (error) {
      reject(error);
    }
  });
}

function convertToBaiduPoint(coords) {
  if (!BMap) return Promise.reject(new Error('地图尚未初始化完成'));
  return new Promise((resolve, reject) => {
    const point = new BMap.Point(Number(coords.lng), Number(coords.lat));
    new BMap.Convertor().translate([point], 1, 5, (result) => {
      if (result.status !== 0 || !result.points?.[0]) {
        reject(new Error('坐标转换失败'));
        return;
      }
      resolve({ lng: Number(result.points[0].lng), lat: Number(result.points[0].lat) });
    });
  });
}

watch(() => props.places, () => renderAll(), { deep: true });
watch(
  () => [props.routes, props.visibleRouteIds, props.selectedRouteId, props.draftRoute],
  scheduleRouteOverlayRender,
  { deep: true }
);
watch(
  () => [props.selectedPlaceId, props.showPlaceLabels],
  scheduleRouteOverlayRender
);
watch(
  () => props.isVisible,
  (visible) => {
    if (visible) nextTick(scheduleMapViewportSync);
  },
  { flush: 'post' }
);

onMounted(initMap);
onBeforeUnmount(() => {
  stopObservingMapViewport();
  if (!map) return;
  map.removeEventListener?.('zoomend', scheduleRouteOverlayRender);
  map.removeEventListener?.('moveend', scheduleRouteOverlayRender);
  clearOverlays(markers);
  clearOverlays(routeLines);
  clearOverlays(routeHalos);
  clearOverlays(routeBadgeLabels);
});

defineExpose({
  focusPlace,
  searchPlaces,
  convertToBaiduPoint
});
</script>
