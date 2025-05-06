const globalhandel = (err, req, res, next) => {
  // Default values for corrupted errors
  let statusCode = 500;
  let message = 'Internal Server Error';
  
  try {
    // Safely extract status code
    if (typeof err.statusCode === 'number' && err.statusCode >= 100 && err.statusCode < 600) {
      statusCode = err.statusCode;
    }
    
    // Safely extract message
    if (typeof err.message === 'string') {
      message = err.message;
    } else if (typeof err === 'string') {
      message = err;
    }
    
    // Handle Stripe-specific errors
    if (err.type && err.type.includes('Stripe')) {
      statusCode = err.statusCode || 502; // Bad Gateway for API issues
      message = 'Payment gateway error';
      
      if (process.env.NODE_ENV === 'development') {
        message = `Stripe Error: ${err.message || 'Unknown Stripe error'}`;
      }
    }
    
    console.error('[ErrorMiddleware]', {
      statusCode,
      message,
      path: req.path,
      method: req.method,
      timestamp: new Date().toISOString(),
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
    
    res.status(statusCode).json({
      status: statusCode >= 500 ? 'error' : 'fail',
      message,
      ...(process.env.NODE_ENV === 'development' && {
        stack: err.stack,
        originalError: err
      })
    });
  } catch (errorHandlingError) {
    // Fallback response if error handling itself fails
    console.error('[ErrorMiddleware CRITICAL] Failed to handle error:', errorHandlingError);
    res.status(500).json({
      status: 'error',
      message: 'Critical server error occurred'
    });
  }
};

module.exports = globalhandel;
