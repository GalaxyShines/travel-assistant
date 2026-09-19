<template>
  <nav class="mobile-bottom-nav" aria-label="主导航">
    <button
      v-for="item in items"
      :key="item.name"
      type="button"
      :class="{ active: activePage === item.name }"
      :aria-current="activePage === item.name ? 'page' : undefined"
      @click="$emit('change', item.name)"
    >
      <el-icon><component :is="item.icon" /></el-icon>
      <span>{{ item.label }}</span>
    </button>
  </nav>
</template>

<script setup>
import { Connection, Location, MapLocation, User } from '@element-plus/icons-vue';

defineProps({
  activePage: {
    type: String,
    required: true
  }
});

defineEmits(['change']);

const items = [
  { name: 'map', label: '主界面', icon: MapLocation },
  { name: 'routes', label: '路线', icon: Connection },
  { name: 'places', label: '标点', icon: Location },
  { name: 'profile', label: '我的', icon: User }
];
</script>
