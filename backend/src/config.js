const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");

const runtimeDir = __dirname;

function resolveMode({ argv = process.argv, env = process.env, bundledMode } = {}) {
  const modeArgument = argv.find((argument) => argument.startsWith("--mode="));
  const mode = modeArgument?.slice("--mode=".length)
    || env.BACKEND_MODE
    || bundledMode
    || "development";

  if (!['development', 'production'].includes(mode)) {
    throw new Error(`Unsupported backend mode: ${mode}`);
  }

  return mode;
}

function loadEnvironment({ directory, mode, targetEnv = process.env }) {
  const modePath = path.join(directory, `.env.${mode}`);
  const fallbackPath = path.join(directory, ".env");
  const envPath = fs.existsSync(modePath) ? modePath : fallbackPath;

  if (!fs.existsSync(envPath)) return null;
  dotenv.config({ path: envPath, processEnv: targetEnv });
  return envPath;
}

const bundledMode = typeof __BACKEND_MODE__ === "undefined" ? undefined : __BACKEND_MODE__;
const mode = resolveMode({ bundledMode });
const environmentDir = path.basename(runtimeDir) === "src"
  ? path.resolve(runtimeDir, "..")
  : runtimeDir;
loadEnvironment({ directory: environmentDir, mode });

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

module.exports = { config, runtimeDir, mode, resolveMode, loadEnvironment };
