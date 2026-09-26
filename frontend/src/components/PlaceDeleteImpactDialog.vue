<template>
  <el-dialog
    :model-value="modelValue"
    title="该地点正在被路线使用"
    width="min(92vw, 560px)"
    :close-on-click-modal="!loading"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <p>删除“{{ place?.name || '该地点' }}”会同步修改以下路线：</p>
    <section v-if="relinkedRoutes.length" class="place-delete-impact-group">
      <h4>自动重连</h4>
      <ul>
        <li v-for="route in relinkedRoutes" :key="route.routeId">
          删除该地点后相邻的两处地点将自动连线。受影响路线：「{{ route.name }}」。{{ occurrenceCopy(route) }}
        </li>
      </ul>
    </section>
    <section v-if="deletedRoutes.length" class="place-delete-impact-group danger">
      <h4>路线将被删除</h4>
      <ul>
        <li v-for="route in deletedRoutes" :key="route.routeId">
          {{ route.reason === 'only-two-stops'
            ? `该路线仅有2个地点，删除该地点会导致路线被删除。受影响路线：「${route.name}」。`
            : `删除并合并相邻重复地点后，路线「${route.name}」将不足 2 个地点，会导致路线被删除。` }}{{ occurrenceCopy(route) }}
        </li>
      </ul>
    </section>
    <template #footer>
      <el-button :disabled="loading" @click="emit('update:modelValue', false)">取消</el-button>
      <el-button type="danger" :loading="loading" @click="emit('confirm')">仍然删除</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  place: { type: Object, default: null },
  impact: { type: Object, default: () => ({ routes: [] }) },
  loading: { type: Boolean, default: false }
});
const emit = defineEmits(['update:modelValue', 'confirm']);

const relinkedRoutes = computed(() => (props.impact?.routes || [])
  .filter((route) => route.outcome === 'relink'));
const deletedRoutes = computed(() => (props.impact?.routes || [])
  .filter((route) => route.outcome === 'delete-route'));

function occurrenceCopy(route) {
  return route.occurrenceIndexes?.length > 1
    ? `该地点位于第 ${route.occurrenceIndexes.join('、')} 站。`
    : '';
}
</script>
