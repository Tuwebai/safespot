/**
 * Centralized Error Handler for SafeSpot
 * 
 * Provides consistent error handling across the application:
 * - Classifies errors (network, backend, validation, unexpected)
 * - Logs errors appropriately
 * - Shows user-friendly messages via Toast
 * - Handles different error scenarios gracefully
 */

export enum ErrorType {
  NETWORK = 'NETWORK',
  BACKEND = 'BACKEND',
  VALIDATION = 'VALIDATION',
  UNAUTHORIZED = 'UNAUTHORIZED',
  NOT_FOUND = 'NOT_FOUND',
  UNEXPECTED = 'UNEXPECTED'
}

export interface ErrorInfo {
  type: ErrorType
  message: string
  originalError?: unknown
  userMessage: string
  shouldLog: boolean
  shouldShowToUser: boolean
}

/**
 * Extract error message from various error types
 */
function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  if (typeof error === 'string') {
    return error
  }
  if (error && typeof error === 'object' && 'message' in error) {
    return String(error.message)
  }
  return 'Error desconocido'
}

/**
 * Classify error type based on error characteristics
 */
function classifyError(error: unknown): ErrorType {
  const message = extractErrorMessage(error).toLowerCase()

  // Network errors
  if (
    message.includes('fetch') ||
    message.includes('network') ||
    message.includes('failed to fetch') ||
    message.includes('connection') ||
    message.includes('timeout')
  ) {
    return ErrorType.NETWORK
  }

  // HTTP status-based classification
  if (error && typeof error === 'object' && 'status' in error) {
    const status = (error as { status: number }).status
    if (status === 401 || status === 403) {
      return ErrorType.UNAUTHORIZED
    }
    if (status === 404) {
      return ErrorType.NOT_FOUND
    }
    if (status >= 400 && status < 500) {
      return ErrorType.VALIDATION
    }
    if (status >= 500) {
      return ErrorType.BACKEND
    }
  }

  // Check for HTTP status in message
  if (message.includes('401') || message.includes('unauthorized')) {
    return ErrorType.UNAUTHORIZED
  }
  if (message.includes('403') || message.includes('forbidden')) {
    return ErrorType.UNAUTHORIZED
  }
  if (message.includes('404') || message.includes('not found')) {
    return ErrorType.NOT_FOUND
  }
  if (message.includes('400') || message.includes('bad request') || message.includes('validation')) {
    return ErrorType.VALIDATION
  }
  if (message.includes('500') || message.includes('server error') || message.includes('internal error')) {
    return ErrorType.BACKEND
  }

  return ErrorType.UNEXPECTED
}

/**
 * Get user-friendly message based on error type
 */
function getUserMessage(errorType: ErrorType, originalMessage: string): string {
  switch (errorType) {
    case ErrorType.NETWORK:
      return 'Error de conexión. Por favor, verifica tu conexión a internet e intenta nuevamente.'
    
    case ErrorType.UNAUTHORIZED:
      return 'No tienes permisos para realizar esta acción.'
    
    case ErrorType.NOT_FOUND:
      return 'El recurso solicitado no fue encontrado.'
    
    case ErrorType.VALIDATION:
      // Try to extract meaningful validation message
      if (originalMessage && originalMessage.length < 100) {
        return originalMessage
      }
      return 'Los datos proporcionados no son válidos. Por favor, verifica e intenta nuevamente.'
    
    case ErrorType.BACKEND:
      return 'Error del servidor. Por favor, intenta nuevamente más tarde.'
    
    case ErrorType.UNEXPECTED:
    default:
      return 'Ocurrió un error inesperado. Por favor, intenta nuevamente.'
  }
}

/**
 * Process error and return structured error information
 */
export function processError(error: unknown, context?: string): ErrorInfo {
  const originalMessage = extractErrorMessage(error)
  const errorType = classifyError(error)
  const userMessage = getUserMessage(errorType, originalMessage)

  // Determine if error should be logged
  // Log all errors except expected validation errors
  const shouldLog = errorType !== ErrorType.VALIDATION

  // Determine if error should be shown to user
  // Show all errors to user except some network errors that might be transient
  const shouldShowToUser = true

  // Log error if needed
  if (shouldLog) {
    const logContext = context ? `[${context}]` : ''
    console.error(`${logContext} Error (${errorType}):`, {
      message: originalMessage,
      error,
      timestamp: new Date().toISOString()
    })
  }

  return {
    type: errorType,
    message: originalMessage,
    originalError: error,
    userMessage,
    shouldLog,
    shouldShowToUser
  }
}

/**
 * Handle error with Toast notification
 * This function requires the Toast system to be available
 * 
 * @param error - The error to handle
 * @param showToastError - Function to show error toast (from useToast hook)
 * @param context - Optional context for logging
 */
export function handleError(
  error: unknown,
  showToastError: (message: string, duration?: number) => void,
  context?: string
): ErrorInfo {
  const errorInfo = processError(error, context)

  if (errorInfo.shouldShowToUser) {
    // Use warning for validation errors, error for others
    if (errorInfo.type === ErrorType.VALIDATION) {
      // For validation errors, we need to use warning, but toast.error is passed
      // We'll show as error but with a less alarming message
      showToastError(errorInfo.userMessage)
    } else {
      showToastError(errorInfo.userMessage)
    }
  }

  return errorInfo
}

/**
 * Handle error silently (log but don't show to user)
 * Useful for non-critical errors
 */
export function handleErrorSilently(error: unknown, context?: string): ErrorInfo {
  const errorInfo = processError(error, context)
  // Error is already logged in processError if shouldLog is true
  return errorInfo
}

/**
 * Handle error with custom user message
 */
export function handleErrorWithMessage(
  error: unknown,
  customMessage: string,
  showToastError: (message: string, duration?: number) => void,
  context?: string
): ErrorInfo {
  const errorInfo = processError(error, context)
  
  // Override user message
  const finalErrorInfo: ErrorInfo = {
    ...errorInfo,
    userMessage: customMessage
  }

  if (finalErrorInfo.shouldShowToUser) {
    showToastError(finalErrorInfo.userMessage)
  }

  return finalErrorInfo
}

