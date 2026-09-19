export const appConfig =
  typeof __APP_CONFIG__ === 'undefined'
    ? {
        appName: '旅行规划地图',
        apiBaseUrl: 'http://localhost:3000/api',
        baiduMapAk: ''
      }
    : __APP_CONFIG__;
