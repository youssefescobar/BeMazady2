// utils/logger.js
const fs = require('fs');
const path = require('path');

const logDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}

const logToConsoleAndFile = (message, type = 'info') => {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [${type.toUpperCase()}] ${message}`;
  const logFile = path.join(logDir, `${timestamp.split('T')[0]}.log`);

  // Log to console
  switch (type) {
    case 'error':
      console.error(logMessage);
      break;
    case 'warn':
      console.warn(logMessage);
      break;
    case 'debug':
      console.debug(logMessage);
      break;
    default:
      console.log(logMessage);
  }

  // Log to file
  fs.appendFileSync(logFile, logMessage + '\n');
};

const logger = {
  info: (message) => logToConsoleAndFile(message, 'info'),
  error: (message) => logToConsoleAndFile(message, 'error'),
  warn: (message) => logToConsoleAndFile(message, 'warn'),
  debug: (message) => logToConsoleAndFile(message, 'debug'),
};

module.exports = logger;
