const fs = require("fs/promises");
const path = require("path");

const CACHE_FILE = process.env.TYPES_CACHE_FILE || "/app/cache/types.json";

async function ensureCacheDir() {
  const dir = path.dirname(CACHE_FILE);
  await fs.mkdir(dir, { recursive: true });
}

async function saveTypesToCache(types) {
  await ensureCacheDir();
  await fs.writeFile(CACHE_FILE, JSON.stringify(types, null, 2), "utf-8");
}

async function readTypesFromCache() {
  try {
    const data = await fs.readFile(CACHE_FILE, "utf-8");
    return JSON.parse(data);
  } catch (error) {
    return [];
  }
}

module.exports = {
  saveTypesToCache,
  readTypesFromCache,
};