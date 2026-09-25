<template>
  <div class="route-place-selector" role="list" aria-label="可选地点">
    <button
      v-for="place in places"
      :key="place.id"
      type="button"
      class="route-place-option"
      :class="{ selected: occurrenceNumbers(place.id).length > 0 }"
      :aria-label="placeAriaLabel(place)"
      @click="emit('place-click', Number(place.id))"
    >
      <span class="route-place-option-copy">
        <strong>{{ place.name }}</strong>
        <small>{{ place.subtitle || place.address || '暂无地址' }}</small>
      </span>
      <span v-if="occurrenceNumbers(place.id).length" class="route-place-order-list" aria-hidden="true">
        <span
          v-for="number in occurrenceNumbers(place.id)"
          :key="number"
          class="route-place-order-badge"
        >
          {{ number }}
        </span>
      </span>
    </button>
    <el-empty v-if="places.length === 0" description="请先添加地点" :image-size="72" />
  </div>
</template>

<script setup>
import { getOccurrenceNumbers } from '../utils/routeDraft';

const props = defineProps({
  places: { type: Array, default: () => [] },
  placeIds: { type: Array, default: () => [] }
});
const emit = defineEmits(['place-click']);

function occurrenceNumbers(placeId) {
  return getOccurrenceNumbers(props.placeIds, placeId);
}

function placeAriaLabel(place) {
  const numbers = occurrenceNumbers(place.id);
  return numbers.length
    ? `${place.name}，路线第 ${numbers.join('、')} 站`
    : `${place.name}，未加入路线`;
}
</script>
