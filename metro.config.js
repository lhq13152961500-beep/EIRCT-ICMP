const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const config = getDefaultConfig(__dirname);

// Exclude .local directory from Metro file watching to prevent ENOENT crashes
// when Replit's internal files are created/deleted during development.
const localDir = path.resolve(__dirname, ".local");
const escapedLocalDir = localDir.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const localBlockPattern = new RegExp("^" + escapedLocalDir + "[\\/\\\\]");

const existingBlockList = config.resolver.blockList;
const existingList = Array.isArray(existingBlockList)
  ? existingBlockList
  : existingBlockList
  ? [existingBlockList]
  : [];

config.resolver.blockList = [...existingList, localBlockPattern];

module.exports = config;
