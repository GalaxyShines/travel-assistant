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
import { getTravelModeLabel } from '../utils/navigation';

const props = defineProps({
  places: {
    type: Array,
    default: () => []
  },
  routes: {
    type: Array,
    default: () => []
  },
  selectedPlaceId: {
    type: [Number, String],
    default: null
  },
  showPlaceLabels: {
    type: Boolean,
    default: true
  },
  showRoutes: {
    type: Boolean,
    default: true
  },
  interactionMode: {
    type: String,
    default: 'browse'
  },
  routeStartPlaceId: {
    type: [Number, String],
    default: null
  },
  showInfoWindows: {
    type: Boolean,
    default: true
  },
  isVisible: {
    type: Boolean,
    default: true
  }
});

const emit = defineEmits(['map-click', 'place-selected', 'route-place-picked', 'route-selected', 'map-availability-changed']);

const mapElement = ref(null);
const mapError = ref('');

let BMap = null;
let map = null;
let markers = [];
let polylines = [];
let resizeObserver = null;
let resizeFrameId = null;

function scheduleMapViewportSync() {
  if (!map || resizeFrameId !== null) {
    return;
  }

  const sync = () => {
    resizeFrameId = null;
    syncMapViewport(map, renderAll);
  };

  resizeFrameId = window.requestAnimationFrame(sync);
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
  if (resizeFrameId !== null) {
    window.cancelAnimationFrame(resizeFrameId);
    resizeFrameId = null;
  }
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

function routePoints(route) {
  return {
    from: toPoint(route.from_lng, route.from_lat),
    to: toPoint(route.to_lng, route.to_lat)
  };
}

function clearOverlays(overlays) {
  overlays.forEach((overlay) => map.removeOverlay(overlay));
  overlays.length = 0;
}

function buildPlaceInfoHtml(place) {
  // 百度地图 InfoWindow 不在 Vue 模板作用域中，按钮通过 App.vue 注册的全局动作回调。
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
        <button onclick="window.travelMapActions?.editPlace(${place.id})">编辑</button>
        <button onclick="window.travelMapActions?.navigateFromPlace(${place.id})">导航到下一站</button>
        <button class="danger" onclick="window.travelMapActions?.deletePlace(${place.id})">删除</button>
      </div>
    </div>
  `;
}

function buildRouteInfoHtml(route) {
  return `
    <div class="map-info">
      <h3>${escapeHtml(route.from_place_name)} → ${escapeHtml(route.to_place_name)}</h3>
      <p>${escapeHtml(getTravelModeLabel(route.travel_mode))} · 顺序 ${escapeHtml(route.order_index)}</p>
      <div class="map-info-actions">
        <button onclick="window.travelMapActions?.navigateRoute(${route.id})">打开百度地图导航</button>
        <button class="danger" onclick="window.travelMapActions?.deleteRoute(${route.id})">删除线路</button>
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
  if (!map || props.places.length === 0) {
    return;
  }

  const points = props.places.map(placePoint);
  if (points.length === 1) {
    map.centerAndZoom(points[0], 15);
    return;
  }

  map.setViewport(points, {
    margins: [56, 56, 56, 56]
  });
}

function renderMarkers() {
  clearOverlays(markers);

  props.places.forEach((place) => {
    const marker = new BMap.Marker(placePoint(place), {
      title: place.name
    });
    const isSelected = Number(place.id) === Number(props.selectedPlaceId);
    const isRouteStart = Number(place.id) === Number(props.routeStartPlaceId);
    const labelText = props.showPlaceLabels
      ? [place.subtitle, isSelected ? '当前' : '', isRouteStart ? '起点' : ''].filter(Boolean).join(' · ')
      : isRouteStart
        ? '起点'
        : '';

    if (labelText) {
      const label = new BMap.Label(escapeHtml(labelText), {
        offset: new BMap.Size(24, -12)
      });
      label.setStyle({
        color: isSelected ? '#ffffff' : '#18212f',
        backgroundColor: isSelected ? '#0f766e' : '#ffffff',
        border: isSelected ? '0' : '1px solid #bfd8d4',
        borderRadius: '4px',
        boxShadow: '0 4px 12px rgba(24, 33, 47, 0.12)',
        padding: '3px 7px',
        fontSize: '12px',
        lineHeight: '16px',
        maxWidth: '160px',
        whiteSpace: 'nowrap'
      });
      marker.setLabel(label);
    }

    marker.addEventListener('click', (event) => {
      stopMapClickPropagation(event);
      if (props.interactionMode === 'route-pick') {
        emit('route-place-picked', place);
        return;
      }
      emit('place-selected', place);
      if (props.showInfoWindows) {
        openPlaceInfo(place);
      }
    });

    map.addOverlay(marker);
    markers.push(marker);
  });
}

function renderPolylines() {
  clearOverlays(polylines);

  if (!props.showRoutes) {
    return;
  }

  props.routes.forEach((route) => {
    const points = routePoints(route);
    const polyline = new BMap.Polyline([points.from, points.to], {
      strokeColor: '#d97706',
      strokeWeight: 5,
      strokeOpacity: 0.78
    });

    polyline.addEventListener('click', (event) => {
      const point =
        event.point ||
        toPoint((Number(route.from_lng) + Number(route.to_lng)) / 2, (Number(route.from_lat) + Number(route.to_lat)) / 2);
      emit('route-selected', route);
      if (props.showInfoWindows) {
        openRouteInfo(route, point);
      }
    });

    map.addOverlay(polyline);
    polylines.push(polyline);
  });
}

function renderAll(options = {}) {
  if (!map) {
    return;
  }

  renderPolylines();
  renderMarkers();
  if (shouldFitViewportAfterRender(options)) {
    nextTick(fitViewport);
  }
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
      if (!event.point || !shouldHandleMapBackgroundClick(props.interactionMode)) {
        return;
      }
      emit('map-click', {
        lng: Number(event.point.lng.toFixed(7)),
        lat: Number(event.point.lat.toFixed(7))
      });
    });

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
  if (!map || !place) {
    return;
  }

  const point = placePoint(place);
  map.panTo(point);
  map.setZoom(Math.max(map.getZoom(), 15));
  if (props.showInfoWindows) {
    openPlaceInfo(place);
  }
}

async function searchPlaces(keyword) {
  if (!map || !BMap) {
    throw new Error(mapError.value || '地图尚未初始化完成');
  }

  const trimmedKeyword = keyword.trim();
  if (!trimmedKeyword) {
    return [];
  }

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
          if (!resultSet) {
            return;
          }

          const count =
            typeof resultSet.getCurrentNumPois === 'function'
              ? resultSet.getCurrentNumPois()
              : typeof resultSet.getNumPois === 'function'
                ? resultSet.getNumPois()
                : 0;

          for (let index = 0; index < count; index += 1) {
            const poi = resultSet.getPoi(index);
            if (!poi?.point) {
              continue;
            }

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

watch(
  () => [props.places, props.routes],
  () => renderAll(),
  { deep: true }
);

watch(
  () => [props.selectedPlaceId, props.showPlaceLabels, props.showRoutes, props.interactionMode, props.routeStartPlaceId],
  () => renderAll()
);

watch(
  () => props.isVisible,
  (visible) => {
    if (visible) {
      nextTick(scheduleMapViewportSync);
    }
  },
  { flush: 'post' }
);

onMounted(initMap);

onBeforeUnmount(() => {
  stopObservingMapViewport();
  if (!map) {
    return;
  }
  clearOverlays(markers);
  clearOverlays(polylines);
});

defineExpose({
  focusPlace,
  searchPlaces
});
</script>
