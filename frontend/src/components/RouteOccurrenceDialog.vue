<template>
  <el-dialog
    :model-value="modelValue"
    title="如何处理已选择地点"
    width="min(92vw, 440px)"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <p>“{{ place?.name || '该地点' }}”已在路线中，请选择操作。</p>
    <div class="route-occurrence-actions">
      <el-button
        v-for="number in occurrenceNumbers"
        :key="number"
        @click="chooseIndex(number)"
      >删除第 {{ number }} 站</el-button>
      <el-button type="danger" plain @click="removeAll">删除该地点的全部出现位置</el-button>
    </div>
    <template #footer>
      <el-button @click="emit('update:modelValue', false)">取消</el-button>
      <el-button type="primary" @click="passAgain">再次经过该地点</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
defineProps({
  modelValue: { type: Boolean, default: false },
  place: { type: Object, default: null },
  occurrenceNumbers: { type: Array, default: () => [] }
});
const emit = defineEmits(['update:modelValue', 'remove-index', 'remove-all', 'pass-again']);

function chooseIndex(number) {
  emit('remove-index', number - 1);
  emit('update:modelValue', false);
}

function removeAll() {
  emit('remove-all');
  emit('update:modelValue', false);
}

function passAgain() {
  emit('pass-again');
  emit('update:modelValue', false);
}
</script>
