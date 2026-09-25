<template>
  <div class="route-meta-form">
    <label class="route-meta-field">
      <span>路线名称</span>
      <el-input
        :model-value="name"
        maxlength="120"
        show-word-limit
        placeholder="例如：第一天"
        @update:model-value="emit('update:name', $event)"
      />
    </label>
    <fieldset class="route-color-field">
      <legend>路线颜色</legend>
      <div class="route-color-swatches">
        <button
          v-for="preset in presets"
          :key="preset"
          type="button"
          class="route-color-swatch"
          :class="{ active: normalizedColor === preset }"
          :style="{ '--route-color': preset }"
          :aria-label="`选择颜色 ${preset}`"
          :aria-pressed="normalizedColor === preset"
          @click="updateColor(preset)"
        />
        <label class="route-custom-color">
          <span>自定义</span>
          <input type="color" :value="normalizedColor" @input="updateColor($event.target.value)" />
        </label>
      </div>
    </fieldset>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const presets = ['#D97706', '#DC2626', '#2563EB', '#16A34A', '#7C3AED', '#DB2777'];
const props = defineProps({
  name: { type: String, default: '' },
  color: { type: String, default: '#D97706' }
});
const emit = defineEmits(['update:name', 'update:color']);
const normalizedColor = computed(() => /^#[0-9A-F]{6}$/i.test(props.color)
  ? props.color.toUpperCase()
  : '#D97706');

function updateColor(color) {
  emit('update:color', String(color).toUpperCase());
}
</script>
