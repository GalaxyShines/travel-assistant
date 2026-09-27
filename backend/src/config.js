const path = require("path");
const runtimeDir = __dirname;
console.log(runtimeDir);
require("dotenv").config({ path: path.join(runtimeDir, ".env") });

function resolveFromRuntime(value, fallback) {
  const rawPath = value || fallback;
  return path.isAbsolute(rawPath) ? rawPath : path.resolve(runtimeDir, rawPath);
}

const config = {
  appName: process.env.APP_NAME || "旅行规划地图",
  backend: {
    port: Number(process.env.BACKEND_PORT || 3000),
    corsOrigin: process.env.CORS_ORIGIN || "http://localhost:5173",
  },
  database: {
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    name: process.env.DB_NAME || "travel_helper",
  },
  auth: {
    password: process.env.AUTH_PASSWORD || "Qwerty@123!",
    sessionFile: resolveFromRuntime(
      process.env.AUTH_SESSION_FILE,
      "data/auth-session.json",
    ),
  },
  baiduMap: {
    ak: process.env.BAIDU_MAP_AK || "",
  },
};

module.exports = { config, runtimeDir };
