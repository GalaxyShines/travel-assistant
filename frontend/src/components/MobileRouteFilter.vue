<template>
  <el-drawer
    :model-value="modelValue"
    direction="btt"
    size="auto"
    title="显示哪些路线"
    class="mobile-route-filter-drawer"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="mobile-route-filter-actions">
      <el-button @click="emit('show-all')">全部显示</el-button>
      <el-button @click="emit('hide-all')">全部隐藏</el-button>
    </div>
    <div class="mobile-route-filter-list">
      <label v-for="route in routes" :key="route.id" class="mobile-route-filter-row">
        <span class="route-color-dot" :style="{ '--route-color': route.color }" />
        <span class="mobile-route-filter-name">{{ route.name }}</span>
        <el-switch
          :model-value="!hiddenRouteIds.has(Number(route.id))"
          :aria-label="`${route.name}显示状态`"
          @change="emit('toggle', Number(route.id))"
        />
      </label>
      <el-empty v-if="routes.length === 0" description="还没有路线" :image-size="64" />
    </div>
  </el-drawer>
</template>

<script setup>
defineProps({
  modelValue: { type: Boolean, default: false },
  routes: { type: Array, default: () => [] },
  hiddenRouteIds: { type: Set, default: () => new Set() }
});
const emit = defineEmits(['update:modelValue', 'toggle', 'show-all', 'hide-all']);
</script>
