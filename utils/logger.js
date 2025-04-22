// utils/logger.js
const logger = {
  info: (message) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [INFO] ${message}`);
  },
  error: (message) => {
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] [ERROR] ${message}`);
  },
  warn: (message) => {
    const timestamp = new Date().toISOString();
    console.warn(`[${timestamp}] [WARN] ${message}`);
  },
  debug: (message) => {
    const timestamp = new Date().toISOString();
    console.debug(`[${timestamp}] [DEBUG] ${message}`);
  }
};

module.exports = logger;