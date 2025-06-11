'use client';

import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Info,
  X,
  RefreshCw,
  Bug,
  Zap,
  Clock,
  Eye,
  EyeOff,
  Brain,
  Database,
  FileText,
  Settings
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { 
  Collapsible, 
  CollapsibleContent, 
  CollapsibleTrigger 
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { getErrorHandler, type AppError, type UserFeedback } from '@/lib/error/error-handler';

interface FeedbackManagerProps {
  className?: string;
  maxVisible?: number;
  showErrorDetails?: boolean;
}

export function FeedbackManager({
  className = '',
  maxVisible = 5,
  showErrorDetails = false
}: FeedbackManagerProps) {
  const [errors, setErrors] = useState<AppError[]>([]);
  const [feedback, setFeedback] = useState<UserFeedback[]>([]);
  const [expandedErrors, setExpandedErrors] = useState<Set<string>>(new Set());
  const [showingDetails, setShowingDetails] = useState<Set<string>>(new Set());

  useEffect(() => {
    const errorHandler = getErrorHandler();
    
    const unsubscribe = errorHandler.subscribe((newErrors, newFeedback) => {
      setErrors(newErrors);
      setFeedback(newFeedback);
    });

    return unsubscribe;
  }, []);

  const dismissFeedback = (feedbackId: string) => {
    getErrorHandler().dismissFeedback(feedbackId);
  };

  const toggleErrorExpansion = (errorId: string) => {
    setExpandedErrors(prev => {
      const newSet = new Set(prev);
      if (newSet.has(errorId)) {
        newSet.delete(errorId);
      } else {
        newSet.add(errorId);
      }
      return newSet;
    });
  };

  const toggleDetails = (errorId: string) => {
    setShowingDetails(prev => {
      const newSet = new Set(prev);
      if (newSet.has(errorId)) {
        newSet.delete(errorId);
      } else {
        newSet.add(errorId);
      }
      return newSet;
    });
  };

  const retryError = async (errorId: string) => {
    const errorHandler = getErrorHandler();
    const success = await errorHandler.attemptRecovery(errorId);
    
    if (!success) {
      errorHandler.addFeedback({
        type: 'warning',
        title: 'Recovery Failed',
        message: 'Unable to automatically recover from this error. Please try manual intervention.',
        duration: 7000,
        actionable: false,
        dismissible: true,
      });
    }
  };

  const getFeedbackIcon = (type: UserFeedback['type']) => {
    switch (type) {
      case 'success':
        return <CheckCircle2 className="h-5 w-5 text-green-600" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-yellow-600" />;
      case 'error':
        return <AlertCircle className="h-5 w-5 text-red-600" />;
      case 'info':
      default:
        return <Info className="h-5 w-5 text-blue-600" />;
    }
  };

  const getFeedbackColor = (type: UserFeedback['type']) => {
    switch (type) {
      case 'success':
        return 'border-green-200 bg-green-50';
      case 'warning':
        return 'border-yellow-200 bg-yellow-50';
      case 'error':
        return 'border-red-200 bg-red-50';
      case 'info':
      default:
        return 'border-blue-200 bg-blue-50';
    }
  };

  const getSeverityColor = (severity: AppError['severity']) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-600 text-white';
      case 'high':
        return 'bg-orange-600 text-white';
      case 'medium':
        return 'bg-yellow-600 text-white';
      case 'low':
      default:
        return 'bg-gray-600 text-white';
    }
  };

  const getTypeIcon = (type: AppError['type']) => {
    const icons = {
      validation: AlertTriangle,
      network: RefreshCw,
      auth: AlertCircle,
      ai: Brain,
      supabase: Database,
      csv: FileText,
      schema: Settings,
      general: Bug,
    };
    return icons[type] || Bug;
  };

  const visibleFeedback = feedback.slice(0, maxVisible);
  const visibleErrors = showErrorDetails ? errors.slice(0, maxVisible) : [];

  if (visibleFeedback.length === 0 && visibleErrors.length === 0) {
    return null;
  }

  return (
    <div className={cn('fixed top-4 right-4 z-50 space-y-3 max-w-md', className)}>
      {/* User Feedback Messages */}
      {visibleFeedback.map((item) => (
        <Card
          key={item.id}
          className={cn(
            'shadow-lg border-l-4 transition-all duration-300 ease-in-out',
            getFeedbackColor(item.type)
          )}
        >
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                {getFeedbackIcon(item.type)}
                <CardTitle className="text-sm font-medium">{item.title}</CardTitle>
              </div>
              {item.dismissible && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={() => dismissFeedback(item.id)}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </CardHeader>
          
          <CardContent className="pt-0">
            <p className="text-sm text-muted-foreground mb-3">{item.message}</p>
            
            {item.actionable && item.actions && (
              <div className="flex gap-2">
                {item.actions.map((action, index) => (
                  <Button
                    key={index}
                    variant={action.style === 'destructive' ? 'destructive' : 
                           action.style === 'primary' ? 'default' : 'outline'}
                    size="sm"
                    onClick={action.handler}
                    className="text-xs"
                  >
                    {action.label}
                  </Button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ))}

      {/* Error Details (if enabled) */}
      {showErrorDetails && visibleErrors.map((error) => {
        const Icon = getTypeIcon(error.type);
        const isExpanded = expandedErrors.has(error.id);
        const showingErrorDetails = showingDetails.has(error.id);

        return (
          <Card key={error.id} className="shadow-lg border-red-200 bg-red-50">
            <Collapsible
              open={isExpanded}
              onOpenChange={() => toggleErrorExpansion(error.id)}
            >
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-red-100 pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-red-600" />
                      <div>
                        <CardTitle className="text-sm font-medium text-red-900">
                          {error.code}
                        </CardTitle>
                        <p className="text-xs text-red-700">{error.userMessage}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={getSeverityColor(error.severity)}>
                        {error.severity}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {error.type}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
              </CollapsibleTrigger>

              <CollapsibleContent>
                <CardContent className="pt-0">
                  <div className="space-y-3">
                    {/* Error Actions */}
                    <div className="flex gap-2">
                      {error.retryable && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => retryError(error.id)}
                          className="gap-2"
                        >
                          <RefreshCw className="h-3 w-3" />
                          Retry
                        </Button>
                      )}
                      
                      {error.recoverable && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => retryError(error.id)}
                          className="gap-2"
                        >
                          <Zap className="h-3 w-3" />
                          Auto-fix
                        </Button>
                      )}

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleDetails(error.id)}
                        className="gap-2"
                      >
                        {showingErrorDetails ? (
                          <EyeOff className="h-3 w-3" />
                        ) : (
                          <Eye className="h-3 w-3" />
                        )}
                        Details
                      </Button>
                    </div>

                    {/* Suggestions */}
                    {error.suggestions && error.suggestions.length > 0 && (
                      <div className="space-y-1">
                        <h4 className="text-xs font-medium text-red-900">Suggestions:</h4>
                        <ul className="text-xs text-red-700 space-y-1">
                          {error.suggestions.map((suggestion, index) => (
                            <li key={index} className="flex items-start gap-1">
                              <span className="text-red-500 mt-0.5">•</span>
                              {suggestion}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Technical Details */}
                    {showingErrorDetails && (
                      <div className="space-y-2">
                        <div className="p-2 bg-red-100 rounded text-xs">
                          <h5 className="font-medium text-red-900 mb-1">Technical Message:</h5>
                          <p className="text-red-800">{error.message}</p>
                        </div>

                        {error.context && (
                          <div className="p-2 bg-red-100 rounded text-xs">
                            <h5 className="font-medium text-red-900 mb-1">Context:</h5>
                            <pre className="text-red-800 overflow-x-auto">
                              {JSON.stringify(error.context, null, 2)}
                            </pre>
                          </div>
                        )}

                        {error.stackTrace && (
                          <div className="p-2 bg-red-100 rounded text-xs">
                            <h5 className="font-medium text-red-900 mb-1">Stack Trace:</h5>
                            <pre className="text-red-800 overflow-x-auto whitespace-pre-wrap">
                              {error.stackTrace}
                            </pre>
                          </div>
                        )}

                        <div className="flex items-center gap-2 text-xs text-red-600">
                          <Clock className="h-3 w-3" />
                          {error.timestamp.toLocaleString()}
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>
        );
      })}

      {/* Error Summary (if there are more errors) */}
      {errors.length > maxVisible && (
        <Card className="shadow-lg border-orange-200 bg-orange-50">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-orange-600" />
                <span className="text-sm font-medium text-orange-900">
                  {errors.length - maxVisible} more error{errors.length - maxVisible !== 1 ? 's' : ''}
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  // This could open a full error log modal
                  console.log('Show all errors:', errors);
                }}
                className="text-xs"
              >
                View All
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Hook for using error handler in components
export function useErrorHandler() {
  const [state, setState] = useState<{ errors: AppError[]; feedback: UserFeedback[] }>({
    errors: [],
    feedback: [],
  });

  useEffect(() => {
    const errorHandler = getErrorHandler();
    const unsubscribe = errorHandler.subscribe((errors, feedback) => {
      setState({ errors, feedback });
    });

    return unsubscribe;
  }, []);

  const handleError = (error: Error | string, context?: any) => {
    return getErrorHandler().handleError(error, context);
  };

  const addFeedback = (feedback: Omit<UserFeedback, 'id' | 'timestamp'>) => {
    return getErrorHandler().addFeedback(feedback);
  };

  const dismissFeedback = (feedbackId: string) => {
    getErrorHandler().dismissFeedback(feedbackId);
  };

  const retryOperation = async <T,>(
    operation: () => Promise<T>,
    context?: any
  ): Promise<T | null> => {
    try {
      return await getErrorHandler().retryOperation(operation, context);
    } catch (error) {
      return null;
    }
  };

  return {
    ...state,
    handleError,
    addFeedback,
    dismissFeedback,
    retryOperation,
  };
}