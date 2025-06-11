'use client';

export interface AppError {
  id: string;
  type: 'validation' | 'network' | 'auth' | 'ai' | 'supabase' | 'csv' | 'schema' | 'general';
  severity: 'low' | 'medium' | 'high' | 'critical';
  code: string;
  message: string;
  userMessage: string;
  technicalDetails?: string;
  context?: Record<string, any>;
  timestamp: Date;
  stackTrace?: string;
  recoverable: boolean;
  retryable: boolean;
  suggestions?: string[];
  relatedErrors?: string[];
}

export interface ErrorHandlerOptions {
  enableLogging?: boolean;
  enableTelemetry?: boolean;
  maxErrorsStored?: number;
  autoRetryAttempts?: number;
  retryDelay?: number;
}

export interface UserFeedback {
  id: string;
  type: 'success' | 'info' | 'warning' | 'error';
  title: string;
  message: string;
  duration?: number; // milliseconds, undefined = persistent
  actionable: boolean;
  actions?: {
    label: string;
    handler: () => void | Promise<void>;
    style?: 'primary' | 'secondary' | 'destructive';
  }[];
  dismissible: boolean;
  context?: Record<string, any>;
  timestamp: Date;
}

export interface ErrorContext {
  userId?: string;
  sessionId?: string;
  userAgent?: string;
  url?: string;
  feature?: string;
  operation?: string;
  metadata?: Record<string, any>;
}

/**
 * Comprehensive error handling and user feedback system
 */
export class ErrorHandler {
  private errors: Map<string, AppError> = new Map();
  private feedback: Map<string, UserFeedback> = new Map();
  private listeners: Set<(errors: AppError[], feedback: UserFeedback[]) => void> = new Set();
  private options: Required<ErrorHandlerOptions>;
  private context: ErrorContext = {};

  constructor(options: ErrorHandlerOptions = {}) {
    this.options = {
      enableLogging: true,
      enableTelemetry: false,
      maxErrorsStored: 100,
      autoRetryAttempts: 3,
      retryDelay: 1000,
      ...options,
    };

    this.initializeContext();
  }

  /**
   * Handle an error with automatic classification and user feedback
   */
  handleError(error: Error | AppError | string, context?: Partial<ErrorContext>): AppError {
    const appError = this.normalizeError(error, context);
    
    // Store error
    this.errors.set(appError.id, appError);
    this.trimErrorsIfNeeded();

    // Log error
    if (this.options.enableLogging) {
      this.logError(appError);
    }

    // Send telemetry
    if (this.options.enableTelemetry) {
      this.sendTelemetry(appError);
    }

    // Generate user feedback
    const feedback = this.generateUserFeedback(appError);
    if (feedback) {
      this.addFeedback(feedback);
    }

    // Notify listeners
    this.notifyListeners();

    return appError;
  }

  /**
   * Add user feedback manually
   */
  addFeedback(feedback: Omit<UserFeedback, 'id' | 'timestamp'>): UserFeedback {
    const fullFeedback: UserFeedback = {
      id: this.generateId(),
      timestamp: new Date(),
      ...feedback,
    };

    this.feedback.set(fullFeedback.id, fullFeedback);
    this.notifyListeners();

    // Auto-dismiss if duration is set
    if (fullFeedback.duration) {
      setTimeout(() => {
        this.dismissFeedback(fullFeedback.id);
      }, fullFeedback.duration);
    }

    return fullFeedback;
  }

  /**
   * Dismiss feedback
   */
  dismissFeedback(feedbackId: string): void {
    this.feedback.delete(feedbackId);
    this.notifyListeners();
  }

  /**
   * Clear all feedback
   */
  clearFeedback(): void {
    this.feedback.clear();
    this.notifyListeners();
  }

  /**
   * Get current errors and feedback
   */
  getState(): { errors: AppError[]; feedback: UserFeedback[] } {
    return {
      errors: Array.from(this.errors.values()).sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()),
      feedback: Array.from(this.feedback.values()).sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()),
    };
  }

  /**
   * Subscribe to error and feedback updates
   */
  subscribe(listener: (errors: AppError[], feedback: UserFeedback[]) => void): () => void {
    this.listeners.add(listener);
    
    // Call immediately with current state
    const { errors, feedback } = this.getState();
    listener(errors, feedback);

    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Update error context
   */
  updateContext(context: Partial<ErrorContext>): void {
    this.context = { ...this.context, ...context };
  }

  /**
   * Attempt to recover from an error
   */
  async attemptRecovery(errorId: string, customRecovery?: () => Promise<void>): Promise<boolean> {
    const error = this.errors.get(errorId);
    if (!error || !error.recoverable) {
      return false;
    }

    try {
      if (customRecovery) {
        await customRecovery();
      } else {
        await this.defaultRecovery(error);
      }

      // Mark error as recovered
      this.errors.delete(errorId);
      this.addFeedback({
        type: 'success',
        title: 'Recovery Successful',
        message: 'The issue has been resolved automatically.',
        duration: 5000,
        actionable: false,
        dismissible: true,
      });

      this.notifyListeners();
      return true;

    } catch (recoveryError) {
      this.handleError(recoveryError as Error, {
        feature: 'error-recovery',
        operation: 'auto-recovery',
        metadata: { originalErrorId: errorId },
      });
      return false;
    }
  }

  /**
   * Retry a failed operation
   */
  async retryOperation<T>(
    operation: () => Promise<T>,
    errorContext?: Partial<ErrorContext>,
    maxAttempts?: number
  ): Promise<T> {
    const attempts = maxAttempts || this.options.autoRetryAttempts;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        if (attempt === attempts) {
          // Final attempt failed
          this.handleError(lastError, {
            ...errorContext,
            metadata: {
              ...errorContext?.metadata,
              attempts,
              finalAttempt: true,
            },
          });
          throw lastError;
        }

        // Wait before retry
        if (attempt < attempts) {
          await new Promise(resolve => setTimeout(resolve, this.options.retryDelay * attempt));
        }
      }
    }

    throw lastError;
  }

  /**
   * Normalize different error types to AppError
   */
  private normalizeError(error: Error | AppError | string, context?: Partial<ErrorContext>): AppError {
    if (typeof error === 'string') {
      return this.createAppError({
        type: 'general',
        code: 'GENERIC_ERROR',
        message: error,
        userMessage: error,
        severity: 'medium',
        recoverable: false,
        retryable: false,
      }, context);
    }

    if ('type' in error && 'code' in error) {
      // Already an AppError
      return {
        ...error,
        context: { ...this.context, ...context, ...error.context },
      };
    }

    // Convert Error to AppError
    const errorType = this.classifyError(error);
    const { severity, recoverable, retryable, suggestions } = this.analyzeError(error);

    return this.createAppError({
      type: errorType,
      code: this.extractErrorCode(error),
      message: error.message,
      userMessage: this.generateUserMessage(error, errorType),
      severity,
      recoverable,
      retryable,
      suggestions,
      technicalDetails: error.stack,
      stackTrace: error.stack,
    }, context);
  }

  /**
   * Create a new AppError
   */
  private createAppError(
    base: Omit<AppError, 'id' | 'timestamp' | 'context'>,
    context?: Partial<ErrorContext>
  ): AppError {
    return {
      ...base,
      id: this.generateId(),
      timestamp: new Date(),
      context: { ...this.context, ...context },
    };
  }

  /**
   * Classify error type based on error properties
   */
  private classifyError(error: Error): AppError['type'] {
    const message = error.message.toLowerCase();
    const name = error.name.toLowerCase();

    if (message.includes('network') || message.includes('fetch') || name.includes('networkerror')) {
      return 'network';
    }
    
    if (message.includes('auth') || message.includes('unauthorized') || message.includes('forbidden')) {
      return 'auth';
    }
    
    if (message.includes('supabase') || message.includes('postgresql')) {
      return 'supabase';
    }
    
    if (message.includes('csv') || message.includes('parse')) {
      return 'csv';
    }
    
    if (message.includes('schema') || message.includes('validation')) {
      return 'schema';
    }
    
    if (message.includes('ai') || message.includes('gemini') || message.includes('generation')) {
      return 'ai';
    }

    return 'general';
  }

  /**
   * Analyze error to determine properties
   */
  private analyzeError(error: Error): {
    severity: AppError['severity'];
    recoverable: boolean;
    retryable: boolean;
    suggestions: string[];
  } {
    const message = error.message.toLowerCase();
    
    // Determine severity
    let severity: AppError['severity'] = 'medium';
    if (message.includes('critical') || message.includes('fatal')) {
      severity = 'critical';
    } else if (message.includes('warning') || message.includes('deprecated')) {
      severity = 'low';
    } else if (message.includes('unauthorized') || message.includes('forbidden')) {
      severity = 'high';
    }

    // Determine if recoverable
    const recoverable = !message.includes('fatal') && 
                       !message.includes('permanent') &&
                       !message.includes('unsupported');

    // Determine if retryable
    const retryable = message.includes('network') ||
                     message.includes('timeout') ||
                     message.includes('rate limit') ||
                     message.includes('temporary');

    // Generate suggestions
    const suggestions: string[] = [];
    if (message.includes('network')) {
      suggestions.push('Check your internet connection');
      suggestions.push('Try again in a few moments');
    }
    if (message.includes('auth')) {
      suggestions.push('Try logging out and back in');
      suggestions.push('Check your account permissions');
    }
    if (message.includes('csv')) {
      suggestions.push('Verify your CSV file format');
      suggestions.push('Check for special characters or encoding issues');
    }
    if (message.includes('rate limit')) {
      suggestions.push('Wait a few minutes before trying again');
      suggestions.push('Consider reducing the frequency of requests');
    }

    return { severity, recoverable, retryable, suggestions };
  }

  /**
   * Extract error code from error
   */
  private extractErrorCode(error: Error): string {
    // Try to extract code from error properties
    if ('code' in error && typeof error.code === 'string') {
      return error.code;
    }
    
    // Generate code from error name/type
    return error.name.toUpperCase().replace(/ERROR$/i, '') || 'UNKNOWN_ERROR';
  }

  /**
   * Generate user-friendly message
   */
  private generateUserMessage(error: Error, type: AppError['type']): string {
    const baseMessages = {
      network: 'Network connection issue. Please check your internet connection.',
      auth: 'Authentication problem. Please try logging in again.',
      supabase: 'Database connection issue. Please try again in a moment.',
      csv: 'Problem processing your CSV file. Please check the file format.',
      schema: 'Schema validation error. Please review your data structure.',
      ai: 'AI service is temporarily unavailable. Please try again later.',
      general: 'An unexpected error occurred. Please try again.',
      validation: 'Data validation error. Please check your input.',
    };

    return baseMessages[type] || baseMessages.general;
  }

  /**
   * Generate user feedback from error
   */
  private generateUserFeedback(error: AppError): UserFeedback | null {
    const actions: UserFeedback['actions'] = [];

    // Add retry action for retryable errors
    if (error.retryable) {
      actions.push({
        label: 'Retry',
        handler: () => {
          // This would trigger a retry of the original operation
          console.log('Retry action triggered for error:', error.id);
        },
        style: 'primary',
      });
    }

    // Add recovery action for recoverable errors
    if (error.recoverable) {
      actions.push({
        label: 'Fix Automatically',
        handler: () => this.attemptRecovery(error.id),
        style: 'secondary',
      });
    }

    // Add suggestion actions
    if (error.suggestions && error.suggestions.length > 0) {
      actions.push({
        label: 'View Suggestions',
        handler: () => {
          console.log('Suggestions for error:', error.suggestions);
        },
        style: 'secondary',
      });
    }

    // Determine feedback type based on severity
    const feedbackType = error.severity === 'critical' ? 'error' :
                        error.severity === 'high' ? 'error' :
                        error.severity === 'medium' ? 'warning' : 'info';

    return {
      type: feedbackType,
      title: this.generateFeedbackTitle(error),
      message: error.userMessage,
      duration: error.severity === 'low' ? 5000 : undefined,
      actionable: actions.length > 0,
      actions: actions.length > 0 ? actions : undefined,
      dismissible: true,
      context: { errorId: error.id },
    } as Omit<UserFeedback, 'id' | 'timestamp'>;
  }

  /**
   * Generate feedback title based on error
   */
  private generateFeedbackTitle(error: AppError): string {
    const titles = {
      network: 'Connection Problem',
      auth: 'Authentication Error',
      supabase: 'Database Error',
      csv: 'File Processing Error',
      schema: 'Schema Validation Error',
      ai: 'AI Service Error',
      general: 'Unexpected Error',
      validation: 'Validation Error',
    };

    return titles[error.type] || 'Error';
  }

  /**
   * Default recovery strategies
   */
  private async defaultRecovery(error: AppError): Promise<void> {
    switch (error.type) {
      case 'network':
        // Test network connectivity
        await fetch('/api/health', { method: 'HEAD' });
        break;
      
      case 'auth':
        // Refresh authentication
        window.location.reload();
        break;
      
      default:
        throw new Error('No default recovery available');
    }
  }

  /**
   * Initialize error context
   */
  private initializeContext(): void {
    if (typeof window !== 'undefined') {
      this.context = {
        userAgent: navigator.userAgent,
        url: window.location.href,
        sessionId: this.generateSessionId(),
      };
    }
  }

  /**
   * Log error for debugging
   */
  private logError(error: AppError): void {
    const logLevel = error.severity === 'critical' ? 'error' :
                    error.severity === 'high' ? 'error' :
                    error.severity === 'medium' ? 'warn' : 'info';

    console[logLevel](`[${error.type.toUpperCase()}] ${error.code}:`, {
      message: error.message,
      userMessage: error.userMessage,
      context: error.context,
      technicalDetails: error.technicalDetails,
      timestamp: error.timestamp,
    });
  }

  /**
   * Send error telemetry (placeholder)
   */
  private sendTelemetry(error: AppError): void {
    // In a real implementation, this would send to a telemetry service
    console.log('Telemetry:', {
      errorType: error.type,
      errorCode: error.code,
      severity: error.severity,
      context: error.context,
      timestamp: error.timestamp,
    });
  }

  /**
   * Notify all listeners of state changes
   */
  private notifyListeners(): void {
    const { errors, feedback } = this.getState();
    this.listeners.forEach(listener => {
      try {
        listener(errors, feedback);
      } catch (error) {
        console.error('Error in error handler listener:', error);
      }
    });
  }

  /**
   * Trim errors if we exceed the maximum
   */
  private trimErrorsIfNeeded(): void {
    if (this.errors.size > this.options.maxErrorsStored) {
      const sortedErrors = Array.from(this.errors.entries())
        .sort(([, a], [, b]) => a.timestamp.getTime() - b.timestamp.getTime());
      
      const toRemove = sortedErrors.slice(0, this.errors.size - this.options.maxErrorsStored);
      toRemove.forEach(([id]) => this.errors.delete(id));
    }
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate session ID
   */
  private generateSessionId(): string {
    return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Global error handler instance
let globalErrorHandler: ErrorHandler | null = null;

/**
 * Get or create global error handler
 */
export function getErrorHandler(options?: ErrorHandlerOptions): ErrorHandler {
  if (!globalErrorHandler) {
    globalErrorHandler = new ErrorHandler(options);
  }
  return globalErrorHandler;
}

/**
 * Convenience functions for common error handling
 */
export const errorUtils = {
  /**
   * Handle async operations with automatic error handling
   */
  async withErrorHandling<T>(
    operation: () => Promise<T>,
    context?: Partial<ErrorContext>
  ): Promise<T | null> {
    try {
      return await operation();
    } catch (error) {
      getErrorHandler().handleError(error as Error, context);
      return null;
    }
  },

  /**
   * Create a success feedback
   */
  success(title: string, message: string, duration = 5000): UserFeedback {
    return getErrorHandler().addFeedback({
      type: 'success',
      title,
      message,
      duration,
      actionable: false,
      dismissible: true,
    });
  },

  /**
   * Create an info feedback
   */
  info(title: string, message: string, actions?: UserFeedback['actions']): UserFeedback {
    return getErrorHandler().addFeedback({
      type: 'info',
      title,
      message,
      actionable: Boolean(actions),
      actions,
      dismissible: true,
    });
  },

  /**
   * Create a warning feedback
   */
  warning(title: string, message: string, actions?: UserFeedback['actions']): UserFeedback {
    return getErrorHandler().addFeedback({
      type: 'warning',
      title,
      message,
      actionable: Boolean(actions),
      actions,
      dismissible: true,
    });
  },
};