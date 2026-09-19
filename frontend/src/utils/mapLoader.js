let loadingPromise = null;

function waitForBaiduMap(timeout = 10000) {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      if (window.BMap) {
        window.clearInterval(timer);
        resolve(window.BMap);
        return;
      }

      if (Date.now() - startedAt > timeout) {
        window.clearInterval(timer);
        reject(new Error('百度地图脚本加载超时，请检查 AK 和网络。'));
      }
    }, 80);
  });
}

export function loadBaiduMap(ak) {
  if (window.BMap) {
    return Promise.resolve(window.BMap);
  }

  if (loadingPromise) {
    return loadingPromise;
  }

  const existingScript = document.querySelector('script[src*="api.map.baidu.com/api"]');
  if (existingScript) {
    loadingPromise = waitForBaiduMap();
    return loadingPromise;
  }

  if (!ak) {
    return Promise.reject(new Error('请先在 app.config.json 的 baiduMap.ak 中填写百度地图 AK。'));
  }

  loadingPromise = new Promise((resolve, reject) => {
    const callbackName = `__travelHelperBaiduMapReady_${Date.now()}`;
    const script = document.createElement('script');

    window[callbackName] = () => {
      delete window[callbackName];
      resolve(window.BMap);
    };

    script.onerror = () => {
      delete window[callbackName];
      reject(new Error('百度地图脚本加载失败，请检查 AK、Referer 白名单和网络。'));
    };

    script.src = `https://api.map.baidu.com/api?v=3.0&ak=${encodeURIComponent(
      ak
    )}&callback=${callbackName}`;
    document.head.appendChild(script);
  });

  return loadingPromise;
}
