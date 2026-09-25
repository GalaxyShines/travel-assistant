<template>
  <div v-if="!isAuthenticated" class="login-shell">
    <section class="login-panel">
      <el-icon class="login-icon"><Lock /></el-icon>
      <h1>{{ appConfig.appName }}</h1>
      <p>请输入授权口令进入旅行规划地图。</p>
      <el-input
        v-model="loginForm.password"
        type="password"
        show-password
        placeholder="授权口令"
        size="large"
        autofocus
        @keyup.enter="login"
      />
      <el-button type="primary" size="large" :loading="loading.login" @click="login">登录</el-button>
    </section>
  </div>

  <div v-else class="app-shell">
    <template v-if="!isMobileViewport">
    <header class="top-bar">
      <div class="brand-block">
        <el-icon class="brand-icon"><MapLocation /></el-icon>
        <div>
          <strong>{{ appConfig.appName }}</strong>
          <span>旅行计划 · 地点 · 多路线 · 百度地图导航</span>
        </div>
      </div>

      <div class="top-actions">
        <el-select
          v-model="selectedTripId"
          placeholder="选择旅行计划"
          class="trip-select"
          :disabled="trips.length === 0"
          @change="selectTrip"
        >
          <el-option v-for="trip in trips" :key="trip.id" :label="trip.name" :value="trip.id" />
        </el-select>
        <el-button type="primary" :icon="Plus" @click="openTripDialog()">新建计划</el-button>
        <el-button :icon="Edit" :disabled="!currentTrip" @click="openTripDialog(currentTrip)">编辑</el-button>
        <el-button :icon="Delete" :disabled="!currentTrip" type="danger" plain @click="deleteCurrentTrip">
          删除
        </el-button>
        <el-button :icon="SwitchButton" plain @click="logout">退出</el-button>
      </div>
    </header>

    <main class="workspace">
      <aside class="side-panel left-panel">
        <section class="panel-section">
          <div class="section-title">
            <h2>旅行计划</h2>
            <el-button size="small" :icon="Refresh" circle @click="loadTrips" />
          </div>
          <el-scrollbar max-height="180px">
            <button
              v-for="trip in trips"
              :key="trip.id"
              class="trip-item"
              :class="{ active: Number(trip.id) === Number(selectedTripId) }"
              @click="selectTrip(trip.id)"
            >
              <strong>{{ trip.name }}</strong>
              <span>{{ trip.description || '暂无描述' }}</span>
            </button>
            <el-empty v-if="trips.length === 0" description="还没有旅行计划" :image-size="72" />
          </el-scrollbar>
        </section>

        <section class="panel-section current-trip" v-if="currentTrip">
          <span>当前计划</span>
          <h2>{{ currentTrip.name }}</h2>
          <p>{{ currentTrip.description || '可以在右侧添加地点和线路。' }}</p>
        </section>

        <section class="panel-section">
          <div class="section-title">
            <h2>地点列表</h2>
            <el-button size="small" :icon="Plus" circle :disabled="!currentTrip" @click="startManualPlace" />
          </div>
          <el-scrollbar max-height="300px">
            <div
              v-for="place in sortedPlaces"
              :key="place.id"
              class="list-row"
              :class="{ active: Number(place.id) === Number(selectedPlaceId) }"
              @click="selectPlace(place)"
            >
              <div class="row-main">
                <span class="order-pill">{{ place.order_index }}</span>
                <div>
                  <strong>{{ place.name }}</strong>
                  <span>{{ place.address || `${place.lng}, ${place.lat}` }}</span>
                </div>
              </div>
              <div class="row-actions" @click.stop>
                <el-button size="small" type="primary" plain @click="goToPlace(place)">去这里</el-button>
                <el-button size="small" :icon="Edit" circle @click="selectPlace(place)" />
                <el-button size="small" :icon="Delete" circle type="danger" plain @click="deletePlace(place)" />
              </div>
            </div>
            <el-empty v-if="sortedPlaces.length === 0" description="当前计划暂无地点" :image-size="72" />
          </el-scrollbar>
        </section>

        <section class="panel-section">
          <RouteList
            :routes="sortedRoutes"
            :hidden-route-ids="hiddenRouteIds"
            :selected-route-id="selectedRouteId"
            @create="startNewRoute"
            @toggle-visibility="toggleRouteVisibility"
            @show-all="showAllRoutes"
            @hide-all="hideAllRoutes"
            @edit="startEditRoute"
            @delete="deleteRoute"
          />
        </section>
      </aside>

      <section class="map-panel">
        <MapView
          ref="desktopMapRef"
          :places="places"
          :routes="routes"
          :visible-route-ids="currentVisibleRouteIds"
          :selected-route-id="selectedRouteId"
          :draft-route="routeEditorMode ? routeDraft : null"
          :selected-place-id="selectedPlaceId"
          interaction-mode="place-pick"
          :is-visible="true"
          @map-click="handleMapClick"
          @place-selected="selectPlace"
          @route-selected="startEditRoute"
        />
      </section>

      <aside class="side-panel right-panel">
        <el-tabs v-model="activeTab" stretch>
          <el-tab-pane label="搜索" name="search">
            <section class="panel-section flat">
              <el-input
                v-model="searchKeyword"
                clearable
                placeholder="搜索火锅、酒店、景点或地点名"
                @keyup.enter="searchBaiduPlaces"
              >
                <template #append>
                  <el-button :icon="Search" :loading="loading.search" @click="searchBaiduPlaces" />
                </template>
              </el-input>

              <div class="search-result-list">
                <div v-for="result in searchResults" :key="`${result.baidu_uid}-${result.lng}-${result.lat}`" class="search-result">
                  <div>
                    <strong>{{ result.name }}</strong>
                    <span>{{ result.address || '暂无地址' }}</span>
                    <small>{{ result.lng }}, {{ result.lat }}</small>
                  </div>
                  <el-button
                    size="small"
                    type="primary"
                    :icon="Plus"
                    :disabled="!currentTrip"
                    @click="addSearchResult(result)"
                  >
                    添加
                  </el-button>
                </div>
                <el-empty v-if="searchResults.length === 0" description="搜索结果会显示在这里" :image-size="72" />
              </div>
            </section>
          </el-tab-pane>

          <el-tab-pane label="地点" name="place">
            <section class="panel-section flat">
              <div class="section-title">
                <h2>{{ placeForm.id ? '编辑地点' : '添加地点' }}</h2>
                <el-button size="small" :icon="Aim" @click="startManualPlace">手动添加</el-button>
              </div>

              <el-form label-position="top" class="edit-form">
                <el-form-item label="地点名称">
                  <el-input v-model="placeForm.name" placeholder="例如：洪崖洞" />
                </el-form-item>
                <el-form-item label="小标题">
                  <el-input
                    v-model="placeForm.subtitle"
                    maxlength="15"
                    show-word-limit
                    placeholder="最多 15 字，显示在地图标点旁"
                  />
                </el-form-item>
                <el-form-item label="地址">
                  <el-input v-model="placeForm.address" placeholder="搜索结果可自动带入，也可以手动填写" />
                </el-form-item>
                <div class="form-grid">
                  <el-form-item label="经度 lng">
                    <el-input-number v-model="placeForm.lng" :precision="7" :step="0.0001" controls-position="right" />
                  </el-form-item>
                  <el-form-item label="纬度 lat">
                    <el-input-number v-model="placeForm.lat" :precision="7" :step="0.0001" controls-position="right" />
                  </el-form-item>
                </div>
                <el-form-item label="计划前往时间">
                  <el-date-picker
                    v-model="placeForm.visit_time"
                    type="datetime"
                    value-format="YYYY-MM-DD HH:mm:ss"
                    format="YYYY-MM-DD HH:mm"
                    placeholder="选择日期和时间"
                    class="full-width"
                  />
                </el-form-item>
                <el-form-item label="预计事项">
                  <el-input v-model="placeForm.todo" type="textarea" :rows="2" placeholder="要做什么、吃什么、打卡什么" />
                </el-form-item>
                <el-form-item label="备注">
                  <el-input v-model="placeForm.note" type="textarea" :rows="3" placeholder="开放时间、门票、停留时间等" />
                </el-form-item>
                <div class="form-grid">
                  <el-form-item label="排序">
                    <el-input-number v-model="placeForm.order_index" :min="0" controls-position="right" />
                  </el-form-item>
                  <el-form-item label="百度 POI uid">
                    <el-input v-model="placeForm.baidu_uid" placeholder="可选" />
                  </el-form-item>
                </div>
                <div class="form-actions">
                  <el-button type="primary" :icon="Check" :loading="loading.place" :disabled="!currentTrip" @click="savePlace">
                    {{ placeForm.id ? '保存地点' : '添加地点' }}
                  </el-button>
                  <el-button @click="resetPlaceForm">清空</el-button>
                </div>
              </el-form>
            </section>
          </el-tab-pane>

          <el-tab-pane label="路线" name="route">
            <section class="panel-section flat">
              <div class="section-title">
                <h2>{{ routeEditorMode === 'edit' ? '编辑路线' : routeEditorMode === 'create' ? '创建路线' : '路线规划' }}</h2>
                <el-button v-if="!routeEditorMode" size="small" type="primary" :disabled="!currentTrip" @click="startNewRoute">创建路线</el-button>
              </div>
              <template v-if="routeEditorMode">
                <template v-if="routeEditorStep === 1">
                  <RoutePlaceSelector
                    :places="sortedPlaces"
                    :place-ids="routeDraft.placeIds"
                    @place-click="handleDraftPlaceClick"
                  />
                  <RouteSequenceEditor
                    :place-ids="routeDraft.placeIds"
                    :places="places"
                    :can-undo="routeHistory.length > 0"
                    @move="moveDraftStop"
                    @remove="removeDraftStop"
                    @undo="undoRouteDraft"
                    @clear="clearRouteDraft"
                  />
                  <div class="form-actions route-editor-actions">
                    <el-button @click="cancelRouteEditor">取消</el-button>
                    <el-button type="primary" :disabled="routeDraft.placeIds.length < 2" @click="routeEditorStep = 2">下一步</el-button>
                  </div>
                </template>
                <template v-else>
                  <RouteMetaForm v-model:name="routeDraft.name" v-model:color="routeDraft.color" />
                  <div class="form-actions route-editor-actions">
                    <el-button @click="routeEditorStep = 1">返回修改</el-button>
                    <el-button type="primary" :loading="loading.route" @click="saveRouteDraft">
                      {{ routeEditorMode === 'edit' ? '保存修改' : '创建路线' }}
                    </el-button>
                  </div>
                </template>
              </template>
              <el-empty v-else description="从左侧路线列表编辑，或创建一条新路线" :image-size="80" />
            </section>
          </el-tab-pane>
        </el-tabs>
      </aside>
    </main>
    </template>

    <main v-else class="mobile-shell">
      <header class="mobile-top-bar">
        <div>
          <strong>{{ currentTrip?.name || appConfig.appName }}</strong>
          <span>{{ currentTrip ? '当前旅行计划' : '请先在“我的”中新建计划' }}</span>
        </div>
        <el-button text :icon="Refresh" aria-label="刷新旅行计划" @click="loadTrips" />
      </header>

      <section v-show="mobilePage === 'map'" class="mobile-map-page">
        <MapView
          ref="mobileMapRef"
          :places="places"
          :routes="routes"
          :visible-route-ids="currentVisibleRouteIds"
          :selected-route-id="selectedRouteId"
          :draft-route="routeEditorMode ? routeDraft : null"
          :selected-place-id="selectedPlaceId"
          :show-place-labels="showPlaceLabels"
          :show-routes="showRoutes"
          :interaction-mode="interactionMode"
          :route-start-place-id="routePickStartPlaceId"
          :show-info-windows="false"
          :is-visible="mobilePage === 'map'"
          @map-click="handleMapClick"
          @place-selected="selectPlace"
          @route-place-picked="handleRoutePlacePicked"
          @route-selected="selectRoute"
          @map-availability-changed="isMapAvailable = $event"
        />
        <MobileMapControls
          :search-keyword="searchKeyword"
          :show-place-labels="showPlaceLabels"
          :show-routes="showRoutes"
          :interaction-mode="interactionMode"
          :map-available="isMapAvailable"
          :has-trip="Boolean(currentTrip)"
          :place-count="places.length"
          :loading-search="loading.search"
          @update:search-keyword="searchKeyword = $event"
          @update:show-place-labels="showPlaceLabels = $event"
          @update:show-routes="showRoutes = $event"
          @search="searchBaiduPlaces"
          @toggle-place-pick="togglePlacePick"
          @toggle-route-pick="toggleRoutePick"
        />
        <p v-if="interactionMode === 'route-pick'" class="mobile-map-tip">
          {{ routePickStartPlaceId ? '请选择终点标点' : '请选择起点标点' }}
        </p>
      </section>

      <section v-if="mobilePage === 'routes'" class="mobile-list-page">
        <div class="mobile-page-heading">
          <div><h1>路线</h1><span>{{ routes.length }} 条路线</span></div>
          <div class="mobile-heading-actions">
            <el-button :icon="Plus" :disabled="!currentTrip" @click="startNewRoute">新增</el-button>
            <el-button :icon="Connection" :disabled="places.length < 2" @click="autoGenerateRoutes">按顺序生成</el-button>
          </div>
        </div>
        <div v-for="route in sortedRoutes" :key="route.id" class="mobile-list-card" @click="selectRoute(route)">
          <div><strong>{{ route.from_place_name }} → {{ route.to_place_name }}</strong><span>{{ getTravelModeLabel(route.travel_mode) }} · 顺序 {{ route.order_index }}</span></div>
          <div class="row-actions" @click.stop>
            <el-button size="small" :icon="Guide" circle @click="navigateRoute(route.id)" />
            <el-button size="small" :icon="Delete" circle type="danger" plain @click="deleteRoute(route)" />
          </div>
        </div>
        <el-empty v-if="sortedRoutes.length === 0" description="当前计划暂无路线" />
      </section>

      <section v-if="mobilePage === 'places'" class="mobile-list-page">
        <div class="mobile-page-heading">
          <div><h1>标点</h1><span>{{ places.length }} 个标点</span></div>
          <el-button type="primary" :icon="Plus" :disabled="!currentTrip" @click="startManualPlace">新增标点</el-button>
        </div>
        <div v-for="place in sortedPlaces" :key="place.id" class="mobile-list-card" @click="selectPlace(place)">
          <div><strong>{{ place.name }}</strong><span>{{ place.address || `${place.lng}, ${place.lat}` }}</span></div>
          <div class="row-actions" @click.stop>
            <el-button size="small" :icon="Guide" circle @click="navigateFromPlace(place.id)" />
            <el-button size="small" :icon="Delete" circle type="danger" plain @click="deletePlace(place)" />
          </div>
        </div>
        <el-empty v-if="sortedPlaces.length === 0" description="当前计划暂无标点" />
      </section>

      <section v-if="mobilePage === 'profile'" class="mobile-list-page">
        <div class="mobile-page-heading"><div><h1>我的</h1><span>旅行计划管理</span></div><el-button type="primary" :icon="Plus" @click="openTripDialog()">新建</el-button></div>
        <div v-for="trip in trips" :key="trip.id" class="mobile-list-card" :class="{ active: Number(trip.id) === Number(selectedTripId) }" @click="selectTrip(trip.id)">
          <div><strong>{{ trip.name }}</strong><span>{{ trip.description || '暂无描述' }}</span></div>
          <div class="row-actions" @click.stop>
            <el-button size="small" :icon="Edit" circle @click="openTripDialog(trip)" />
          </div>
        </div>
        <el-empty v-if="trips.length === 0" description="还没有旅行计划" />
        <div class="mobile-profile-actions">
          <el-button :icon="Refresh" @click="loadTrips">刷新计划</el-button>
          <el-button :icon="Delete" type="danger" plain :disabled="!currentTrip" @click="deleteCurrentTrip">删除当前计划</el-button>
          <el-button :icon="SwitchButton" plain @click="logout">退出登录</el-button>
        </div>
      </section>

      <MobileBottomNav :active-page="mobilePage" @change="switchMobilePage" />

      <el-drawer :model-value="mobileOverlay === 'place-detail'" direction="btt" size="auto" title="标点详情" @close="closeMobileOverlay('place-detail')">
        <template v-if="selectedPlace">
          <div class="mobile-detail"><h2>{{ selectedPlace.name }}</h2><p>{{ selectedPlace.subtitle || selectedPlace.address || '暂无地址' }}</p><dl><dt>计划时间</dt><dd>{{ selectedPlace.visit_time || '未设置' }}</dd><dt>待办</dt><dd>{{ selectedPlace.todo || '无' }}</dd><dt>备注</dt><dd>{{ selectedPlace.note || '无' }}</dd></dl></div>
          <div class="mobile-drawer-actions"><el-button :icon="Edit" @click="mobileOverlay = 'place-form'">编辑</el-button><el-button :icon="Guide" type="primary" @click="navigateFromPlace(selectedPlace.id)">导航到下一站</el-button><el-button :icon="Delete" type="danger" plain @click="deletePlace(selectedPlace)">删除</el-button></div>
        </template>
      </el-drawer>

      <el-drawer :model-value="mobileOverlay === 'search-results'" direction="rtl" size="100%" title="搜索结果" @close="closeMobileOverlay('search-results')">
        <div class="search-result-list">
          <div v-for="result in searchResults" :key="`${result.baidu_uid}-${result.lng}-${result.lat}`" class="search-result"><div><strong>{{ result.name }}</strong><span>{{ result.address || '暂无地址' }}</span></div><el-button type="primary" :disabled="!currentTrip" @click="addSearchResult(result)">添加</el-button></div>
          <el-empty v-if="searchResults.length === 0" description="没有找到匹配地点" />
        </div>
      </el-drawer>

      <el-drawer :model-value="mobileOverlay === 'place-form'" direction="rtl" size="100%" :title="placeForm.id ? '编辑标点' : '新增标点'" @close="closeMobileOverlay('place-form')">
        <el-form label-position="top" class="edit-form mobile-edit-form">
          <el-form-item label="地点名称"><el-input v-model="placeForm.name" placeholder="例如：洪崖洞" /></el-form-item>
          <el-form-item label="小标题"><el-input v-model="placeForm.subtitle" maxlength="15" show-word-limit placeholder="最多 15 字" /></el-form-item>
          <el-form-item label="地址"><el-input v-model="placeForm.address" placeholder="可手动填写" /></el-form-item>
          <div class="form-grid"><el-form-item label="经度 lng"><el-input-number v-model="placeForm.lng" :precision="7" :step="0.0001" controls-position="right" /></el-form-item><el-form-item label="纬度 lat"><el-input-number v-model="placeForm.lat" :precision="7" :step="0.0001" controls-position="right" /></el-form-item></div>
          <el-form-item label="计划前往时间"><el-date-picker v-model="placeForm.visit_time" type="datetime" value-format="YYYY-MM-DD HH:mm:ss" format="YYYY-MM-DD HH:mm" placeholder="选择日期和时间" class="full-width" /></el-form-item>
          <el-form-item label="预计事项"><el-input v-model="placeForm.todo" type="textarea" :rows="3" /></el-form-item>
          <el-form-item label="备注"><el-input v-model="placeForm.note" type="textarea" :rows="4" /></el-form-item>
          <div class="form-grid"><el-form-item label="排序"><el-input-number v-model="placeForm.order_index" :min="0" controls-position="right" /></el-form-item><el-form-item label="百度 POI uid"><el-input v-model="placeForm.baidu_uid" /></el-form-item></div>
          <div class="mobile-drawer-actions"><el-button @click="closeMobileOverlay">取消</el-button><el-button type="primary" :loading="loading.place" @click="savePlace">保存标点</el-button></div>
        </el-form>
      </el-drawer>

      <el-drawer :model-value="mobileOverlay === 'route-form'" direction="rtl" size="100%" :title="routeForm.id ? '编辑路线' : '确认路线'" @close="closeMobileOverlay('route-form')">
        <el-form label-position="top" class="edit-form mobile-edit-form">
          <el-form-item label="起点"><el-select v-model="routeForm.from_place_id" filterable class="full-width"><el-option v-for="place in sortedPlaces" :key="place.id" :label="place.name" :value="place.id" /></el-select></el-form-item>
          <el-form-item label="终点"><el-select v-model="routeForm.to_place_id" filterable class="full-width"><el-option v-for="place in sortedPlaces" :key="place.id" :label="place.name" :value="place.id" /></el-select></el-form-item>
          <el-button :icon="SwitchIcon" :disabled="!routeForm.from_place_id || !routeForm.to_place_id" @click="swapRouteEndpoints">互换起终点</el-button>
          <el-form-item label="交通方式" class="mobile-route-mode"><el-radio-group v-model="routeForm.travel_mode" class="mode-group"><el-radio-button v-for="mode in travelModeOptions" :key="mode.value" :label="mode.value">{{ mode.label }}</el-radio-button></el-radio-group></el-form-item>
          <el-form-item label="排序"><el-input-number v-model="routeForm.order_index" :min="0" controls-position="right" class="full-width" /></el-form-item>
          <div class="mobile-drawer-actions"><el-button @click="closeMobileOverlay">取消</el-button><el-button type="primary" :loading="loading.route" @click="saveRoute">{{ routeForm.id ? '保存路线' : '创建路线' }}</el-button></div>
        </el-form>
      </el-drawer>
    </main>

    <el-dialog v-model="tripDialog.visible" :title="tripDialog.isEdit ? '编辑旅行计划' : '创建旅行计划'" width="420px">
      <el-form label-position="top">
        <el-form-item label="计划名称">
          <el-input v-model="tripDialog.form.name" placeholder="例如：重庆毕业旅行" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="tripDialog.form.description" type="textarea" :rows="3" placeholder="写一点旅行目标或备注" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="tripDialog.visible = false">取消</el-button>
        <el-button type="primary" :loading="loading.trip" @click="saveTrip">保存</el-button>
      </template>
    </el-dialog>

    <RouteOccurrenceDialog
      v-model="routeOccurrenceState.visible"
      :place="routeOccurrenceState.place"
      :occurrence-numbers="routeOccurrenceState.occurrenceNumbers"
      @remove-index="removeDraftOccurrence"
      @remove-all="removeAllDraftOccurrences"
      @pass-again="appendRepeatedDraftPlace"
    />

    <PlaceDeleteImpactDialog
      v-model="placeDeleteState.visible"
      :place="placeDeleteState.place"
      :impact="placeDeleteState.impact"
      :loading="placeDeleteState.loading"
      @confirm="confirmForceDeletePlace"
    />
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import {
  Aim,
  Check,
  Connection,
  Delete,
  Edit,
  Guide,
  MapLocation,
  Plus,
  Refresh,
  Search,
  Lock,
  Switch as SwitchIcon,
  SwitchButton
} from '@element-plus/icons-vue';
import MapView from './components/MapView.vue';
import MobileBottomNav from './components/MobileBottomNav.vue';
import MobileMapControls from './components/MobileMapControls.vue';
import PlaceDeleteImpactDialog from './components/PlaceDeleteImpactDialog.vue';
import RouteList from './components/RouteList.vue';
import RouteMetaForm from './components/RouteMetaForm.vue';
import RouteOccurrenceDialog from './components/RouteOccurrenceDialog.vue';
import RoutePlaceSelector from './components/RoutePlaceSelector.vue';
import RouteSequenceEditor from './components/RouteSequenceEditor.vue';
import { appConfig } from './config';
import {
  authApi,
  clearAuthToken,
  getAuthToken,
  placeApi,
  routeApi,
  setAuthToken,
  setUnauthorizedHandler,
  tripApi
} from './services/api';
import {
  buildBaiduSelfLocateDrivingUrl,
  getTravelModeLabel,
  navigateToPlace,
  openBaiduNavigation,
  travelModeOptions
} from './utils/navigation';
import { createEmptyPlaceForm, placeFormFromPlace, placePayloadFromForm } from './utils/placeForm';
import { createEmptyRouteForm, routeFormFromRoute, routePayloadFromForm, swapRoutePlaces } from './utils/routeForm';
import { MAP_INTERACTION_MODES, clearInteraction, pickRouteEndpoint, toggleInteractionMode } from './utils/mapInteraction';
import { loadMapDisplayPreferences, saveMapDisplayPreferences } from './utils/mapPreferences';
import { hasDuplicateRoute } from './utils/routeDuplicate';
import {
  appendStop,
  createRouteDraft,
  getOccurrenceNumbers,
  moveStop,
  removeAllStops,
  removeStopAt,
  routeDraftPayload,
  routeToDraft,
  undoStops
} from './utils/routeDraft';
import {
  loadHiddenRouteIds,
  saveHiddenRouteIds,
  visibleRouteIds
} from './utils/routeVisibility';
import { attemptPasswordParamLogin, removePasswordLoginParam } from './utils/passwordLogin';
import { resolveMobileOverlayClose } from './utils/mobileOverlay';

const desktopMapRef = ref(null);
const mobileMapRef = ref(null);
const isAuthenticated = ref(Boolean(getAuthToken()));
const trips = ref([]);
const places = ref([]);
const routes = ref([]);
const selectedTripId = ref(null);
const selectedPlaceId = ref(null);
const selectedRouteId = ref(null);
const routeDraft = reactive(createRouteDraft());
const routeEditorStep = ref(1);
const routeEditorMode = ref(null);
const routeHistory = ref([]);
const hiddenRouteIds = ref(new Set());
const routeOccurrenceState = reactive({
  visible: false,
  place: null,
  occurrenceNumbers: []
});
const placeDeleteState = reactive({
  visible: false,
  place: null,
  impact: null,
  loading: false
});
const activeTab = ref('search');
const searchKeyword = ref('');
const searchResults = ref([]);
const isMobileViewport = ref(typeof window !== 'undefined' ? window.matchMedia('(max-width: 760px)').matches : false);
const mobilePage = ref('map');
const mobileOverlay = ref(null);
const interactionMode = ref(MAP_INTERACTION_MODES.BROWSE);
const routePickStartPlaceId = ref(null);
const isMapAvailable = ref(false);
const initialMapPreferences = loadMapDisplayPreferences(typeof window !== 'undefined' ? window.localStorage : null);
const showPlaceLabels = ref(initialMapPreferences.showPlaceLabels);
const showRoutes = ref(initialMapPreferences.showRoutes);
let mobileViewportQuery = null;

function updateMobileViewport(event) {
  isMobileViewport.value = event.matches;
  if (!event.matches) {
    closeMobileOverlay();
  }
}

const loading = reactive({
  trip: false,
  place: false,
  route: false,
  search: false,
  list: false,
  login: false
});

const loginForm = reactive({
  password: ''
});

const tripDialog = reactive({
  visible: false,
  isEdit: false,
  form: {
    id: null,
    name: '',
    description: ''
  }
});

const placeForm = reactive(createEmptyPlaceForm());
const routeForm = reactive(createEmptyRouteForm());

const currentTrip = computed(() => trips.value.find((trip) => Number(trip.id) === Number(selectedTripId.value)));
const selectedPlace = computed(() => places.value.find((place) => Number(place.id) === Number(selectedPlaceId.value)) || null);
const activeMapRef = computed(() => isMobileViewport.value ? mobileMapRef.value : desktopMapRef.value);

const sortedPlaces = computed(() =>
  [...places.value].sort((a, b) => Number(a.order_index) - Number(b.order_index) || Number(a.id) - Number(b.id))
);

const sortedRoutes = computed(() =>
  [...routes.value].sort((a, b) => Number(a.order_index) - Number(b.order_index) || Number(a.id) - Number(b.id))
);
const currentVisibleRouteIds = computed(() => visibleRouteIds(routes.value, hiddenRouteIds.value));

watch([showPlaceLabels, showRoutes], () => {
  if (typeof window !== 'undefined') {
    saveMapDisplayPreferences(
      { showPlaceLabels: showPlaceLabels.value, showRoutes: showRoutes.value },
      window.localStorage
    );
  }
});

function resetPlaceForm() {
  Object.assign(placeForm, createEmptyPlaceForm(), {
    order_index: places.value.length
  });
  selectedPlaceId.value = null;
}

function resetRouteForm() {
  Object.assign(routeForm, createEmptyRouteForm(routes.value.length));
  selectedRouteId.value = null;
}

function resetRouteDraftState() {
  Object.assign(routeDraft, createRouteDraft(routes.value.length));
  routeEditorStep.value = 1;
  routeEditorMode.value = null;
  routeHistory.value = [];
  selectedRouteId.value = null;
  routeOccurrenceState.visible = false;
  routeOccurrenceState.place = null;
  routeOccurrenceState.occurrenceNumbers = [];
}

function exitMapInteraction() {
  const cleared = clearInteraction();
  interactionMode.value = cleared.mode;
  routePickStartPlaceId.value = cleared.startPlaceId;
}

function closeMobileOverlay(closedOverlay = null) {
  const nextOverlay = resolveMobileOverlayClose(mobileOverlay.value, closedOverlay);
  if (nextOverlay === mobileOverlay.value) {
    return;
  }

  mobileOverlay.value = nextOverlay;
  exitMapInteraction();
}

function switchMobilePage(page) {
  mobilePage.value = page;
  closeMobileOverlay();
}

function togglePlacePick() {
  if (!currentTrip.value) {
    ElMessage.warning('请先创建或选择一个旅行计划');
    return;
  }
  interactionMode.value = toggleInteractionMode(interactionMode.value, MAP_INTERACTION_MODES.PLACE_PICK);
  routePickStartPlaceId.value = null;
}

function toggleRoutePick() {
  if (!currentTrip.value || places.value.length < 2) {
    ElMessage.warning('至少需要两个标点才能连线');
    return;
  }
  interactionMode.value = toggleInteractionMode(interactionMode.value, MAP_INTERACTION_MODES.ROUTE_PICK);
  routePickStartPlaceId.value = null;
}

function resetWorkspaceState() {
  trips.value = [];
  places.value = [];
  routes.value = [];
  selectedTripId.value = null;
  selectedPlaceId.value = null;
  selectedRouteId.value = null;
  searchResults.value = [];
  searchKeyword.value = '';
  mobilePage.value = 'map';
  mobileOverlay.value = null;
  hiddenRouteIds.value = new Set();
  placeDeleteState.visible = false;
  exitMapInteraction();
  resetRouteForm();
  resetRouteDraftState();
  resetPlaceForm();
}

async function applyLoginSession(session) {
  setAuthToken(session.token);
  loginForm.password = '';
  isAuthenticated.value = true;
  bindMapInfoWindowActions();
  await loadTrips();
  ElMessage.success('登录成功');
}

async function loginWithPassword(password) {
  const session = await authApi.login({ password });
  await applyLoginSession(session);
}

async function login() {
  if (!loginForm.password) {
    ElMessage.warning('请输入授权口令');
    return;
  }

  loading.login = true;
  try {
    await loginWithPassword(loginForm.password);
  } catch (error) {
    ElMessage.error(error.message);
  } finally {
    loading.login = false;
  }
}

async function loginFromPasswordParam() {
  if (typeof window === 'undefined' || isAuthenticated.value) {
    return;
  }

  loading.login = true;
  try {
    const result = await attemptPasswordParamLogin({
      location: window.location,
      history: window.history,
      login: loginWithPassword
    });

    if (result.attempted) {
      loginForm.password = '';
    }
  } catch (error) {
    ElMessage.error(error.message);
  } finally {
    loading.login = false;
  }
}

function logout() {
  clearAuthToken();
  isAuthenticated.value = false;
  resetWorkspaceState();
  delete window.travelMapActions;
}

function placePayload() {
  return placePayloadFromForm(placeForm);
}

function placeFromRoute(route, side) {
  if (side === 'from') {
    return {
      id: route.from_place_id,
      name: route.from_place_name,
      address: route.from_place_address,
      lng: Number(route.from_lng),
      lat: Number(route.from_lat)
    };
  }

  return {
    id: route.to_place_id,
    name: route.to_place_name,
    address: route.to_place_address,
    lng: Number(route.to_lng),
    lat: Number(route.to_lat)
  };
}

function normalizeRoute(route) {
  return {
    ...route,
    id: Number(route.id),
    trip_id: Number(route.trip_id),
    order_index: Number(route.order_index),
    version: Number(route.version),
    color: String(route.color || '#D97706').toUpperCase(),
    stops: (route.stops || []).map((stop) => ({
      ...stop,
      id: Number(stop.id),
      place_id: Number(stop.place_id),
      stop_index: Number(stop.stop_index),
      lng: Number(stop.lng),
      lat: Number(stop.lat)
    }))
  };
}

async function loadTrips() {
  loading.list = true;
  try {
    const data = await tripApi.list();
    trips.value = data || [];

    if (trips.value.length === 0) {
      selectedTripId.value = null;
      places.value = [];
      routes.value = [];
      hiddenRouteIds.value = new Set();
      resetPlaceForm();
      resetRouteDraftState();
      return;
    }

    const stillExists = trips.value.some((trip) => Number(trip.id) === Number(selectedTripId.value));
    selectedTripId.value = stillExists ? selectedTripId.value : trips.value[0].id;
    await loadTripData();
  } catch (error) {
    ElMessage.error(error.message);
  } finally {
    loading.list = false;
  }
}

async function loadTripData() {
  if (!selectedTripId.value) {
    places.value = [];
    routes.value = [];
    hiddenRouteIds.value = new Set();
    resetRouteDraftState();
    return;
  }

  try {
    const [placeData, routeData] = await Promise.all([
      placeApi.list(selectedTripId.value),
      routeApi.list(selectedTripId.value)
    ]);
    places.value = placeData || [];
    routes.value = (routeData || []).map(normalizeRoute);
    hiddenRouteIds.value = loadHiddenRouteIds(
      selectedTripId.value,
      routes.value,
      typeof window !== 'undefined' ? window.localStorage : null
    );
    resetPlaceForm();
    resetRouteForm();
    resetRouteDraftState();
  } catch (error) {
    ElMessage.error(error.message);
  }
}

async function selectTrip(tripId) {
  selectedTripId.value = Number(tripId);
  selectedPlaceId.value = null;
  selectedRouteId.value = null;
  searchResults.value = [];
  closeMobileOverlay();
  await loadTripData();
}

function openTripDialog(trip) {
  tripDialog.isEdit = Boolean(trip);
  tripDialog.form.id = trip?.id || null;
  tripDialog.form.name = trip?.name || '';
  tripDialog.form.description = trip?.description || '';
  tripDialog.visible = true;
}

async function saveTrip() {
  if (!tripDialog.form.name.trim()) {
    ElMessage.warning('请填写旅行计划名称');
    return;
  }

  loading.trip = true;
  try {
    const payload = {
      name: tripDialog.form.name,
      description: tripDialog.form.description
    };
    const savedTrip = tripDialog.isEdit
      ? await tripApi.update(tripDialog.form.id, payload)
      : await tripApi.create(payload);

    tripDialog.visible = false;
    selectedTripId.value = savedTrip.id;
    await loadTrips();
    ElMessage.success('旅行计划已保存');
  } catch (error) {
    ElMessage.error(error.message);
  } finally {
    loading.trip = false;
  }
}

async function deleteCurrentTrip() {
  if (!currentTrip.value) {
    return;
  }

  try {
    await ElMessageBox.confirm(`确定删除「${currentTrip.value.name}」及其地点、路线吗？`, '删除旅行计划', {
      type: 'warning'
    });
    await tripApi.remove(currentTrip.value.id);
    selectedTripId.value = null;
    await loadTrips();
    ElMessage.success('旅行计划已删除');
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') {
      ElMessage.error(error.message || '删除已取消');
    }
  }
}

function startManualPlace() {
  resetPlaceForm();
  resetRouteForm();
  if (isMobileViewport.value) {
    mobilePage.value = 'places';
    mobileOverlay.value = 'place-form';
  } else {
    activeTab.value = 'place';
  }
}

function handleMapClick(point) {
  if (isMobileViewport.value && interactionMode.value !== MAP_INTERACTION_MODES.PLACE_PICK) {
    return;
  }
  if (!currentTrip.value) {
    ElMessage.warning('请先创建或选择一个旅行计划');
    return;
  }

  Object.assign(placeForm, createEmptyPlaceForm(), {
    name: '地图选点',
    subtitle: '',
    lng: point.lng,
    lat: point.lat,
    order_index: places.value.length
  });
  selectedPlaceId.value = null;
  selectedRouteId.value = null;
  if (isMobileViewport.value) {
    mobileOverlay.value = 'place-form';
  } else {
    activeTab.value = 'place';
  }
}

function selectPlace(place) {
  selectedPlaceId.value = place.id;
  selectedRouteId.value = null;
  Object.assign(placeForm, placeFormFromPlace(place));
  if (isMobileViewport.value) {
    mobileOverlay.value = 'place-detail';
  } else {
    activeTab.value = 'place';
  }
  activeMapRef.value?.focusPlace(place.id);
}

function handleRoutePlacePicked(place) {
  if (interactionMode.value !== MAP_INTERACTION_MODES.ROUTE_PICK) {
    return;
  }

  const selection = pickRouteEndpoint(routePickStartPlaceId.value, place.id);
  if (selection.invalid) {
    ElMessage.warning('起点和终点不能相同');
    return;
  }

  if (!selection.complete) {
    routePickStartPlaceId.value = selection.startPlaceId;
    ElMessage.info('已选择起点，请选择终点标点');
    return;
  }

  const candidate = {
    from_place_id: selection.startPlaceId,
    to_place_id: selection.endPlaceId
  };
  if (hasDuplicateRoute(routes.value, candidate)) {
    ElMessage.warning('路线已存在');
    return;
  }

  Object.assign(routeForm, createEmptyRouteForm(routes.value.length), candidate);
  selectedRouteId.value = null;
  mobileOverlay.value = 'route-form';
}

function startNewRoute() {
  if (isMobileViewport.value) {
    resetRouteForm();
    mobilePage.value = 'routes';
    mobileOverlay.value = 'route-form';
  } else {
    resetRouteDraftState();
    Object.assign(routeDraft, createRouteDraft(routes.value.length));
    routeEditorMode.value = 'create';
    activeTab.value = 'route';
  }
}

function startEditRoute(route) {
  resetRouteDraftState();
  Object.assign(routeDraft, routeToDraft(route));
  routeEditorMode.value = 'edit';
  selectedRouteId.value = Number(route.id);
  selectedPlaceId.value = null;
  activeTab.value = 'route';
}

function applyDraftResult(next) {
  if (next.error === 'adjacent-duplicate') {
    ElMessage.warning('相邻地点不能相同');
    return;
  }
  if (!next.changed) return;
  routeHistory.value.push([...routeDraft.placeIds]);
  routeDraft.placeIds = next.placeIds;
  if (next.mergedAdjacent) ElMessage.info('已合并相邻的相同地点');
}

async function handleDraftPlaceClick(placeId) {
  const place = places.value.find((item) => Number(item.id) === Number(placeId));
  if (!place) return;
  const occurrenceNumbers = getOccurrenceNumbers(routeDraft.placeIds, placeId);
  if (occurrenceNumbers.length === 0) {
    applyDraftResult(appendStop(routeDraft.placeIds, placeId));
    return;
  }

  try {
    await ElMessageBox.confirm(`“${place.name}”已在路线中，请选择操作。`, '已选择该地点', {
      confirmButtonText: '再次经过该地点',
      cancelButtonText: '删除该地点',
      distinguishCancelAndClose: true,
      type: 'info'
    });
    applyDraftResult(appendStop(routeDraft.placeIds, placeId));
  } catch (action) {
    if (action === 'close') return;
    if (action !== 'cancel') throw action;
    if (occurrenceNumbers.length === 1) {
      applyDraftResult(removeStopAt(routeDraft.placeIds, occurrenceNumbers[0] - 1));
      return;
    }
    routeOccurrenceState.place = place;
    routeOccurrenceState.occurrenceNumbers = occurrenceNumbers;
    routeOccurrenceState.visible = true;
  }
}

function appendRepeatedDraftPlace() {
  if (routeOccurrenceState.place) {
    applyDraftResult(appendStop(routeDraft.placeIds, routeOccurrenceState.place.id));
  }
}

function removeDraftOccurrence(index) {
  applyDraftResult(removeStopAt(routeDraft.placeIds, index));
}

function removeAllDraftOccurrences() {
  if (routeOccurrenceState.place) {
    applyDraftResult(removeAllStops(routeDraft.placeIds, routeOccurrenceState.place.id));
  }
}

function moveDraftStop(fromIndex, toIndex) {
  applyDraftResult(moveStop(routeDraft.placeIds, fromIndex, toIndex));
}

function removeDraftStop(index) {
  applyDraftResult(removeStopAt(routeDraft.placeIds, index));
}

function undoRouteDraft() {
  const previous = undoStops(routeHistory.value);
  if (!previous) return;
  routeDraft.placeIds = previous;
  routeHistory.value = routeHistory.value.slice(0, -1);
}

function clearRouteDraft() {
  if (routeDraft.placeIds.length === 0) return;
  routeHistory.value.push([...routeDraft.placeIds]);
  routeDraft.placeIds = [];
}

function cancelRouteEditor() {
  resetRouteDraftState();
}

function persistHiddenRouteIds() {
  saveHiddenRouteIds(
    selectedTripId.value,
    hiddenRouteIds.value,
    typeof window !== 'undefined' ? window.localStorage : null
  );
}

function toggleRouteVisibility(routeId) {
  const next = new Set(hiddenRouteIds.value);
  const numericId = Number(routeId);
  if (next.has(numericId)) next.delete(numericId);
  else next.add(numericId);
  hiddenRouteIds.value = next;
  persistHiddenRouteIds();
}

function showAllRoutes() {
  hiddenRouteIds.value = new Set();
  persistHiddenRouteIds();
}

function hideAllRoutes() {
  hiddenRouteIds.value = new Set(routes.value.map((route) => Number(route.id)));
  persistHiddenRouteIds();
}

async function saveRouteDraft() {
  if (!currentTrip.value) {
    ElMessage.warning('请先选择旅行计划');
    return;
  }
  if (routeDraft.placeIds.length < 2) {
    ElMessage.warning('路线至少需要两个地点');
    return;
  }
  if (!routeDraft.name.trim()) {
    ElMessage.warning('请填写路线名称');
    return;
  }

  loading.route = true;
  try {
    const wasEditing = Boolean(routeDraft.id);
    const saved = routeDraft.id
      ? await routeApi.update(routeDraft.id, routeDraftPayload(routeDraft))
      : await routeApi.create(selectedTripId.value, routeDraftPayload(routeDraft));
    await loadTripData();
    selectedRouteId.value = Number(saved.id);
    ElMessage.success(wasEditing ? '路线已保存' : '路线已创建');
  } catch (error) {
    ElMessage.error(error.message);
  } finally {
    loading.route = false;
  }
}

function selectRoute(route) {
  selectedRouteId.value = route.id;
  selectedPlaceId.value = null;
  Object.assign(routeForm, routeFormFromRoute(route));
  if (isMobileViewport.value) {
    mobileOverlay.value = 'route-form';
  } else {
    activeTab.value = 'route';
  }
}

function routePayload() {
  return routePayloadFromForm(routeForm);
}

function swapRouteEndpoints() {
  swapRoutePlaces(routeForm);
}

async function savePlace() {
  if (!currentTrip.value) {
    ElMessage.warning('请先选择旅行计划');
    return;
  }
  if (!placeForm.name.trim() || placeForm.lng === null || placeForm.lat === null) {
    ElMessage.warning('请填写地点名称、经度和纬度');
    return;
  }
  if (placeForm.subtitle && Array.from(placeForm.subtitle.trim()).length > 15) {
    ElMessage.warning('地点小标题最多 15 字');
    return;
  }

  loading.place = true;
  try {
    const savedPlace = placeForm.id
      ? await placeApi.update(placeForm.id, placePayload())
      : await placeApi.create(selectedTripId.value, placePayload());

    await loadTripData();
    const freshPlace = places.value.find((place) => Number(place.id) === Number(savedPlace.id));
    if (freshPlace) {
      selectPlace(freshPlace);
    }
    exitMapInteraction();
    ElMessage.success('地点已保存');
  } catch (error) {
    ElMessage.error(error.message);
  } finally {
    loading.place = false;
  }
}

async function deletePlace(place) {
  try {
    await ElMessageBox.confirm(`确定删除地点「${place.name}」吗？`, '删除地点', {
      type: 'warning'
    });
    await placeApi.remove(place.id);
    await loadTripData();
    if (isMobileViewport.value) {
      closeMobileOverlay();
    }
    ElMessage.success('地点已删除');
  } catch (error) {
    if (error?.status === 409 && error?.details?.type === 'PLACE_IN_ROUTES') {
      placeDeleteState.place = place;
      placeDeleteState.impact = error.details;
      placeDeleteState.visible = true;
      return;
    }
    if (error !== 'cancel' && error !== 'close') {
      ElMessage.error(error.message || '删除已取消');
    }
  }
}

async function confirmForceDeletePlace() {
  if (!placeDeleteState.place) return;
  placeDeleteState.loading = true;
  try {
    const summary = await placeApi.remove(placeDeleteState.place.id, { force: true });
    placeDeleteState.visible = false;
    placeDeleteState.place = null;
    placeDeleteState.impact = null;
    await loadTripData();
    if (isMobileViewport.value) closeMobileOverlay();
    const relinkedCount = summary?.relinkedRoutes?.length || 0;
    const deletedCount = summary?.deletedRoutes?.length || 0;
    ElMessage.success(`地点已删除，重连 ${relinkedCount} 条路线，删除 ${deletedCount} 条路线`);
  } catch (error) {
    ElMessage.error(error.message);
  } finally {
    placeDeleteState.loading = false;
  }
}

async function deletePlaceById(placeId) {
  const place = places.value.find((item) => Number(item.id) === Number(placeId));
  if (place) {
    await deletePlace(place);
  }
}

async function goToPlace(place) {
  try {
    if (!activeMapRef.value?.convertToBaiduPoint) {
      throw new Error('地图组件尚未加载完成');
    }
    await navigateToPlace(place, {
      geolocation: navigator.geolocation,
      convertToBaiduPoint: activeMapRef.value.convertToBaiduPoint,
      openWindow: (url) => window.open(url, '_blank', 'noopener,noreferrer')
    });
  } catch (error) {
    try {
      await ElMessageBox.confirm(
        `${error.message || '无法获取当前位置'}，是否交由百度地图定位？`,
        '无法获取当前位置',
        {
          confirmButtonText: '交由百度地图定位',
          cancelButtonText: '取消',
          type: 'warning'
        }
      );
      window.open(buildBaiduSelfLocateDrivingUrl(place), '_blank', 'noopener,noreferrer');
    } catch (action) {
      if (action !== 'cancel' && action !== 'close') {
        ElMessage.error(action.message || '导航失败');
      }
    }
  }
}

async function goToPlaceById(placeId) {
  const place = places.value.find((item) => Number(item.id) === Number(placeId));
  if (place) await goToPlace(place);
}

async function searchBaiduPlaces() {
  if (!searchKeyword.value.trim()) {
    ElMessage.warning('请输入搜索关键词');
    return;
  }

  loading.search = true;
  try {
    if (!activeMapRef.value) {
      throw new Error('地图组件尚未加载完成');
    }
    searchResults.value = await activeMapRef.value.searchPlaces(searchKeyword.value);
    if (isMobileViewport.value) {
      mobileOverlay.value = 'search-results';
    }
    if (searchResults.value.length === 0) {
      ElMessage.info('没有找到匹配地点');
    }
  } catch (error) {
    ElMessage.error(error.message);
  } finally {
    loading.search = false;
  }
}

async function addSearchResult(result) {
  if (!currentTrip.value) {
    ElMessage.warning('请先选择旅行计划');
    return;
  }

  try {
    await placeApi.create(selectedTripId.value, {
      name: result.name,
      address: result.address,
      subtitle: '',
      lng: result.lng,
      lat: result.lat,
      note: '',
      visit_time: null,
      todo: '',
      order_index: places.value.length,
      baidu_uid: result.baidu_uid
    });
    await loadTripData();
    if (isMobileViewport.value) {
      mobileOverlay.value = null;
      mobilePage.value = 'map';
    }
    ElMessage.success('地点已添加到当前计划');
  } catch (error) {
    ElMessage.error(error.message);
  }
}

async function saveRoute() {
  if (!currentTrip.value) {
    ElMessage.warning('请先选择旅行计划');
    return;
  }
  if (!routeForm.from_place_id || !routeForm.to_place_id) {
    ElMessage.warning('请选择起点和终点');
    return;
  }
  if (Number(routeForm.from_place_id) === Number(routeForm.to_place_id)) {
    ElMessage.warning('起点和终点不能相同');
    return;
  }
  if (hasDuplicateRoute(routes.value, routeForm, routeForm.id)) {
    ElMessage.warning('路线已存在');
    return;
  }

  loading.route = true;
  try {
    const isEditingRoute = Boolean(routeForm.id);
    const savedRoute = routeForm.id
      ? await routeApi.update(routeForm.id, routePayload())
      : await routeApi.create(selectedTripId.value, routePayload());

    await loadTripData();
    const freshRoute = routes.value.find((route) => Number(route.id) === Number(savedRoute.id));
    if (freshRoute) {
      if (isMobileViewport.value) {
        selectedRouteId.value = freshRoute.id;
        mobilePage.value = 'routes';
        mobileOverlay.value = null;
      } else {
        selectRoute(freshRoute);
      }
    }
    exitMapInteraction();
    ElMessage.success(isEditingRoute ? '路线已保存' : '路线连线已创建');
  } catch (error) {
    ElMessage.error(error.message);
  } finally {
    loading.route = false;
  }
}

async function autoGenerateRoutes() {
  if (sortedPlaces.value.length < 2) {
    ElMessage.warning('至少需要两个地点');
    return;
  }

  loading.route = true;
  try {
    const existingKeys = new Set(routes.value.map((route) => `${route.from_place_id}-${route.to_place_id}`));
    let createdCount = 0;

    for (let index = 0; index < sortedPlaces.value.length - 1; index += 1) {
      const fromPlace = sortedPlaces.value[index];
      const toPlace = sortedPlaces.value[index + 1];
      const key = `${fromPlace.id}-${toPlace.id}`;

      if (existingKeys.has(key)) {
        continue;
      }

      await routeApi.create(selectedTripId.value, {
        from_place_id: fromPlace.id,
        to_place_id: toPlace.id,
        travel_mode: routeForm.travel_mode,
        order_index: routes.value.length + createdCount
      });
      createdCount += 1;
    }

    await loadTripData();
    ElMessage.success(createdCount > 0 ? `已生成 ${createdCount} 条路线` : '顺序路线已存在');
  } catch (error) {
    ElMessage.error(error.message);
  } finally {
    loading.route = false;
  }
}

async function deleteRoute(route) {
  try {
    await ElMessageBox.confirm(`确定删除路线「${route.name || '未命名路线'}」吗？`, '删除路线', {
      type: 'warning'
    });
    await routeApi.remove(route.id);
    await loadTripData();
    if (isMobileViewport.value) {
      closeMobileOverlay();
    }
    ElMessage.success('路线已删除');
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') {
      ElMessage.error(error.message || '删除已取消');
    }
  }
}

function selectRouteById(routeId) {
  const route = routes.value.find((item) => Number(item.id) === Number(routeId));
  if (!route) return;
  if (isMobileViewport.value) selectRoute(route);
  else startEditRoute(route);
}

async function deleteRouteById(routeId) {
  const route = routes.value.find((item) => Number(item.id) === Number(routeId));
  if (route) {
    await deleteRoute(route);
  }
}

function navigateRoute(routeId) {
  const route = routes.value.find((item) => Number(item.id) === Number(routeId));
  if (!route) {
    ElMessage.warning('路线不存在');
    return;
  }

  openBaiduNavigation(placeFromRoute(route, 'from'), placeFromRoute(route, 'to'), route.travel_mode);
}

function navigateFromPlace(placeId) {
  const nextRoute = sortedRoutes.value.find((route) => Number(route.from_place_id) === Number(placeId));
  if (!nextRoute) {
    ElMessage.warning('当前地点还没有连接到下一站');
    return;
  }

  navigateRoute(nextRoute.id);
}

function bindMapInfoWindowActions() {
  window.travelMapActions = {
    editPlace: (id) => {
      const place = places.value.find((item) => Number(item.id) === Number(id));
      if (place) {
        selectPlace(place);
      }
    },
    deletePlace: deletePlaceById,
    goToPlace: goToPlaceById,
    editRoute: selectRouteById
  };
}

onMounted(() => {
  if (typeof window !== 'undefined') {
    mobileViewportQuery = window.matchMedia('(max-width: 760px)');
    isMobileViewport.value = mobileViewportQuery.matches;
    mobileViewportQuery.addEventListener('change', updateMobileViewport);
  }

  setUnauthorizedHandler((message) => {
    isAuthenticated.value = false;
    resetWorkspaceState();
    delete window.travelMapActions;
    ElMessage.warning(message || '登录已失效，请重新登录');
  });

  if (isAuthenticated.value) {
    if (typeof window !== 'undefined') {
      removePasswordLoginParam(window.location, window.history);
    }
    bindMapInfoWindowActions();
    loadTrips();
  } else {
    loginFromPasswordParam();
  }
});

onBeforeUnmount(() => {
  setUnauthorizedHandler(null);
  delete window.travelMapActions;
  mobileViewportQuery?.removeEventListener('change', updateMobileViewport);
});
</script>
