<template>
  <section class="route-list" :class="{ compact }" aria-label="路线列表">
    <div class="route-list-toolbar">
      <el-button type="primary" @click="emit('create')">创建路线</el-button>
      <div>
        <el-button size="small" @click="emit('show-all')">全部显示</el-button>
        <el-button size="small" @click="emit('hide-all')">全部隐藏</el-button>
      </div>
    </div>
    <div v-if="routes.length" class="route-list-items">
      <article
        v-for="route in routes"
        :key="route.id"
        class="route-list-card"
        :class="{ active: Number(selectedRouteId) === Number(route.id) }"
      >
        <button type="button" class="route-list-main" @click="emit('edit', route)">
          <span class="route-color-dot" :style="{ '--route-color': route.color }" />
          <span>
            <strong>{{ route.name }}</strong>
            <small>{{ route.stops?.length || 0 }} 个地点</small>
          </span>
        </button>
        <div class="route-list-actions">
          <el-switch
            :model-value="!hiddenRouteIds.has(Number(route.id))"
            :aria-label="`${route.name}显示状态`"
            @click.stop
            @change="emit('toggle-visibility', Number(route.id))"
          />
          <el-button size="small" @click.stop="emit('edit', route)">编辑</el-button>
          <el-button size="small" type="danger" plain @click.stop="emit('delete', route)">删除</el-button>
        </div>
      </article>
    </div>
    <el-empty v-else description="还没有路线" :image-size="72" />
  </section>
</template>

<script setup>
defineProps({
  routes: { type: Array, default: () => [] },
  hiddenRouteIds: { type: Set, default: () => new Set() },
  selectedRouteId: { type: [Number, String], default: null },
  compact: { type: Boolean, default: false }
});
const emit = defineEmits([
  'create',
  'toggle-visibility',
  'show-all',
  'hide-all',
  'edit',
  'delete'
]);
</script>
