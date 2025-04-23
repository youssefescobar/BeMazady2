// utils/logger.js

const logToConsole = (message, type = 'info') => {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [${type.toUpperCase()}] ${message}`;

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
};

module.exports = {
  info: (message) => logToConsole(message, 'info'),
  error: (message) => logToConsole(message, 'error'),
  warn: (message) => logToConsole(message, 'warn'),
  debug: (message) => logToConsole(message, 'debug'),
};
