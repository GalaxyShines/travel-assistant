<template>
  <section class="route-sequence-editor" aria-label="路线地点顺序">
    <div class="route-sequence-toolbar">
      <span>已选择 {{ placeIds.length }} 站</span>
      <div>
        <el-button size="small" :disabled="!canUndo" @click="emit('undo')">撤销</el-button>
        <el-button size="small" :disabled="placeIds.length === 0" @click="emit('clear')">清空</el-button>
      </div>
    </div>
    <div v-if="placeIds.length" class="route-sequence-list">
      <div
        v-for="(placeId, index) in placeIds"
        :key="`${placeId}-${index}`"
        class="route-sequence-row"
      >
        <span class="route-place-order-badge">{{ index + 1 }}</span>
        <strong>{{ placeById.get(Number(placeId))?.name || `地点 ${placeId}` }}</strong>
        <div class="route-sequence-actions">
          <el-button size="small" :disabled="index === 0" @click="emit('move', index, index - 1)">上移</el-button>
          <el-button
            size="small"
            :disabled="index === placeIds.length - 1"
            @click="emit('move', index, index + 1)"
          >下移</el-button>
          <el-button size="small" type="danger" plain @click="emit('remove', index)">删除</el-button>
        </div>
      </div>
    </div>
    <el-empty v-else description="按前往顺序选择地点" :image-size="64" />
    <p v-if="placeIds.length" class="route-sequence-summary">{{ summary }}</p>
  </section>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  placeIds: { type: Array, default: () => [] },
  places: { type: Array, default: () => [] },
  canUndo: { type: Boolean, default: false }
});
const emit = defineEmits(['move', 'remove', 'undo', 'clear']);

const placeById = computed(() => new Map(
  props.places.map((place) => [Number(place.id), place])
));
const summary = computed(() => props.placeIds
  .map((id) => placeById.value.get(Number(id))?.name || `地点 ${id}`)
  .join(' → '));
</script>
