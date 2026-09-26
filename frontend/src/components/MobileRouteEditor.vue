<template>
  <el-drawer
    :model-value="modelValue"
    direction="rtl"
    size="100%"
    :title="mode === 'edit' ? '编辑路线' : '创建路线'"
    class="mobile-route-editor-drawer"
    :before-close="requestClose"
  >
    <div class="mobile-route-editor-shell">
      <main class="mobile-route-editor-content">
        <RoutePlaceSelector
          v-if="step === 1"
          :places="places"
          :place-ids="draft.placeIds"
          @place-click="emit('place-click', $event)"
        />
        <RouteMetaForm
          v-else
          :name="draft.name"
          :color="draft.color"
          @update:name="emit('update-name', $event)"
          @update:color="emit('update-color', $event)"
        />
      </main>

      <footer class="mobile-route-editor-footer">
        <template v-if="step === 1">
          <button
            type="button"
            class="mobile-route-sequence-toggle"
            :aria-expanded="sequenceExpanded"
            @click="sequenceExpanded = !sequenceExpanded"
          >
            <span>已选 {{ draft.placeIds.length }} 个地点</span>
            <span>{{ sequenceExpanded ? '收起顺序' : '查看顺序' }}</span>
          </button>
          <div v-if="sequenceExpanded" class="mobile-route-sequence-panel">
            <RouteSequenceEditor
              :place-ids="draft.placeIds"
              :places="places"
              :can-undo="canUndo"
              @move="(...args) => emit('move', ...args)"
              @remove="emit('remove', $event)"
              @undo="emit('undo')"
              @clear="emit('clear')"
            />
          </div>
          <div class="mobile-route-editor-actions">
            <el-button :disabled="!canUndo" @click="emit('undo')">撤销</el-button>
            <el-button :disabled="draft.placeIds.length === 0" @click="emit('clear')">清空</el-button>
            <el-button type="primary" :disabled="draft.placeIds.length < 2" @click="emit('next')">下一步</el-button>
          </div>
        </template>
        <div v-else class="mobile-route-editor-actions">
          <el-button @click="emit('back')">返回修改</el-button>
          <el-button type="primary" :loading="loading" @click="emit('save')">
            {{ mode === 'edit' ? '保存修改' : '创建路线' }}
          </el-button>
        </div>
      </footer>
    </div>
  </el-drawer>
</template>

<script setup>
import { ref } from 'vue';
import RouteMetaForm from './RouteMetaForm.vue';
import RoutePlaceSelector from './RoutePlaceSelector.vue';
import RouteSequenceEditor from './RouteSequenceEditor.vue';

defineProps({
  modelValue: { type: Boolean, default: false },
  draft: { type: Object, required: true },
  places: { type: Array, default: () => [] },
  step: { type: Number, default: 1 },
  mode: { type: String, default: 'create' },
  loading: { type: Boolean, default: false },
  canUndo: { type: Boolean, default: false }
});
const emit = defineEmits([
  'update:modelValue',
  'place-click',
  'move',
  'remove',
  'undo',
  'clear',
  'next',
  'back',
  'save',
  'cancel',
  'update-name',
  'update-color'
]);
const sequenceExpanded = ref(false);

function requestClose() {
  emit('cancel');
}
</script>
