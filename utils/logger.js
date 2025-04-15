// utils/logger.js
const fs = require('fs');
const path = require('path');

const logDir = path.join(__dirname, '../logs');

// Create logs directory if it doesn't exist
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}

const logToFile = (message, type = 'info') => {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [${type.toUpperCase()}] ${message}\n`;
  
  // Log to console
  console.log(logMessage);
  
  // Log to file
  const logFile = path.join(logDir, `${new Date().toISOString().split('T')[0]}.log`);
  fs.appendFileSync(logFile, logMessage);
};

module.exports = {
  info: (message) => logToFile(message, 'info'),
  error: (message) => logToFile(message, 'error'),
  warn: (message) => logToFile(message, 'warn'),
  debug: (message) => logToFile(message, 'debug')
};