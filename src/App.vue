<script setup>
import { computed, defineAsyncComponent, reactive } from 'vue'
import ScriptsHomePage from './pages/ScriptsHomePage.vue'

const componentModules = import.meta.glob('./components/dynamic/**/*.vue')
const pageModules = import.meta.glob('./pages/**/*.vue')

const moduleMap = {
  ...componentModules,
  ...pageModules,
}

const toLabel = (path) => {
  const fileName = path.split('/').pop()?.replace('.vue', '') || path
  return fileName
}

const options = computed(() => {
  const componentOptions = Object.keys(componentModules).map((path) => ({
    path,
    type: '组件',
    label: toLabel(path),
  }))

  const pageOptions = Object.keys(pageModules).map((path) => ({
    path,
    type: '页面',
    label: toLabel(path),
  }))

  return [...componentOptions, ...pageOptions]
})

const createPanel = (slotName, selectedPath = '') => ({
  slotName,
  selectedPath,
})

const panels = reactive([
  createPanel('栏位 A'),
  createPanel('栏位 B'),
  createPanel('栏位 C'),
  createPanel('栏位 D'),
])

const getAsyncView = (path) => {
  if (!path || !moduleMap[path]) {
    return null
  }
  return defineAsyncComponent(moduleMap[path])
}
</script>

<template>
  <main class="app-shell">
    <header class="header">
      <h1>多栏动态加载演示（Vue + HMR）</h1>
      <p>每个栏位先是空白，选择一个组件或页面后会异步加载，并在开发模式下自动热更新。</p>
    </header>

    <section class="panel">
      <div class="panel-head">
        <h2>顶层脚本列表</h2>
      </div>
      <div class="panel-body">
        <ScriptsHomePage />
      </div>
    </section>

    <section class="panel-grid">
      <article v-for="panel in panels" :key="panel.slotName" class="panel">
        <div class="panel-head">
          <h2>{{ panel.slotName }}</h2>
          <select v-model="panel.selectedPath">
            <option value="">保持空白</option>
            <option v-for="item in options" :key="item.path" :value="item.path">
              {{ item.type }} · {{ item.label }}
            </option>
          </select>
        </div>

        <div class="panel-body">
          <component :is="getAsyncView(panel.selectedPath)" v-if="panel.selectedPath" />
          <div v-else class="placeholder">空白栏位</div>
        </div>
      </article>
    </section>
  </main>
</template>
