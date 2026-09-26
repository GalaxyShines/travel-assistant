<template>
  <section class="mobile-map-controls">
    <el-input
      :model-value="searchKeyword"
      clearable
      placeholder="搜索地点、酒店、景点"
      @update:model-value="$emit('update:searchKeyword', $event)"
      @keyup.enter="$emit('search')"
    >
      <template #append>
        <el-button :icon="Search" :loading="loadingSearch" aria-label="搜索地点" @click="$emit('search')" />
      </template>
    </el-input>

    <div class="mobile-map-switches">
      <el-switch
        :model-value="showPlaceLabels"
        active-text="显示小标题"
        @update:model-value="$emit('update:showPlaceLabels', $event)"
      />
      <el-button size="small" @click="$emit('open-route-filter')">
        路线 {{ visibleRouteCount }}/{{ routeCount }}
      </el-button>
    </div>

    <div class="mobile-map-mode-actions">
      <el-button
        :type="interactionMode === 'place-pick' ? 'primary' : 'default'"
        :icon="Aim"
        :disabled="!hasTrip || !mapAvailable"
        @click="$emit('toggle-place-pick')"
      >
        {{ interactionMode === 'place-pick' ? '取消选点' : '地图选点' }}
      </el-button>
    </div>
  </section>
</template>

<script setup>
import { Aim, Search } from '@element-plus/icons-vue';

defineProps({
  searchKeyword: { type: String, default: '' },
  showPlaceLabels: { type: Boolean, default: true },
  interactionMode: { type: String, default: 'browse' },
  mapAvailable: { type: Boolean, default: false },
  hasTrip: { type: Boolean, default: false },
  routeCount: { type: Number, default: 0 },
  visibleRouteCount: { type: Number, default: 0 },
  loadingSearch: { type: Boolean, default: false }
});

defineEmits([
  'update:searchKeyword',
  'update:showPlaceLabels',
  'search',
  'toggle-place-pick',
  'open-route-filter'
]);
</script>
