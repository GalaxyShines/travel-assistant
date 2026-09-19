import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootConfigPath = path.resolve(__dirname, 'app.config.json');

function readRootConfig() {
  const fallback = {
    appName: '旅行规划地图',
    frontend: {
      port: 5173,
      apiBaseUrl: 'http://localhost:3000/api'
    },
    baiduMap: {
      ak: ''
    }
  };

  if (!fs.existsSync(rootConfigPath)) {
    return fallback;
  }

  return {
    ...fallback,
    ...JSON.parse(fs.readFileSync(rootConfigPath, 'utf8'))
  };
}

const rootConfig = readRootConfig();
const publicConfig = {
  appName: rootConfig.appName || '旅行规划地图',
  apiBaseUrl: rootConfig.frontend?.apiBaseUrl || 'http://localhost:3000/api',
  baiduMapAk: rootConfig.baiduMap?.ak || ''
};

function baiduMapScriptPlugin(ak) {
  return {
    name: 'inject-baidu-map-script',
    transformIndexHtml() {
      if (!ak) {
        return [];
      }

      return [
        {
          tag: 'script',
          attrs: {
            type: 'text/javascript',
            src: `https://api.map.baidu.com/api?v=3.0&ak=${encodeURIComponent(ak)}`
          },
          injectTo: 'head'
        }
      ];
    }
  };
}

export default defineConfig({
  plugins: [vue(), baiduMapScriptPlugin(publicConfig.baiduMapAk)],
  define: {
    __APP_CONFIG__: JSON.stringify(publicConfig)
  },
  server: {
    port: Number(rootConfig.frontend?.port || 5173),
    strictPort: false
  },
  base: '/travel-helper/'
});
