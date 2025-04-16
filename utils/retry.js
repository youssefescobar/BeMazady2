/**
 * Retry a function with exponential backoff
 * @param {Function} fn - The function to retry
 * @param {number} maxRetries - Maximum number of retries
 * @param {number} baseDelay - Base delay in milliseconds
 * @returns {Promise} - The result of the function
 */
const retryWithBackoff = async (fn, maxRetries = 3, baseDelay = 300) => {
    let lastError
  
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await fn()
      } catch (error) {
        console.log(`Attempt ${attempt + 1} failed: ${error.message}`)
        lastError = error
  
        // Don't retry for certain error types
        if (error.response && (error.response.status === 400 || error.response.status === 401)) {
          throw error
        }
  
        // Calculate delay with exponential backoff
        const delay = baseDelay * Math.pow(2, attempt)
        console.log(`Retrying in ${delay}ms...`)
        await new Promise((resolve) => setTimeout(resolve, delay))
      }
    }
  
    throw lastError
  }
  
  module.exports = { retryWithBackoff }
  