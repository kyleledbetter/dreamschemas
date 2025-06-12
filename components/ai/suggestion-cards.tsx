'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Lightbulb, 
  Zap, 
  Database, 
  Shield, 
  TrendingUp,
  ChevronDown,
  ChevronUp,
  Target
} from 'lucide-react';
import type { AISchemaAnalysis } from '../../lib/ai/schema-analyzer';

interface SuggestionCardsProps {
  suggestions: AISchemaAnalysis['suggestions'];
  onAcceptSuggestion?: (suggestionIndex: number) => void;
  onRejectSuggestion?: (suggestionIndex: number) => void;
  onViewDetails?: (suggestionIndex: number) => void;
  className?: string;
}

export function SuggestionCards({
  suggestions,
  onAcceptSuggestion,
  onRejectSuggestion,
  onViewDetails,
  className = ""
}: SuggestionCardsProps) {
  const [expandedCards, setExpandedCards] = useState<Set<number>>(new Set());
  const [acceptedSuggestions, setAcceptedSuggestions] = useState<Set<number>>(new Set());
  const [rejectedSuggestions, setRejectedSuggestions] = useState<Set<number>>(new Set());

  const toggleExpanded = (index: number) => {
    const newExpanded = new Set(expandedCards);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedCards(newExpanded);
  };

  const handleAccept = (index: number) => {
    setAcceptedSuggestions(prev => new Set(prev).add(index));
    setRejectedSuggestions(prev => {
      const newSet = new Set(prev);
      newSet.delete(index);
      return newSet;
    });
    onAcceptSuggestion?.(index);
  };

  const handleReject = (index: number) => {
    setRejectedSuggestions(prev => new Set(prev).add(index));
    setAcceptedSuggestions(prev => {
      const newSet = new Set(prev);
      newSet.delete(index);
      return newSet;
    });
    onRejectSuggestion?.(index);
  };

  const categorizedSuggestions = categorizeSuggestions(suggestions);

  if (suggestions.length === 0) {
    return (
      <Card className={className}>
        <CardContent className="p-6 text-center">
          <Lightbulb className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No suggestions available</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">AI Suggestions</h3>
        <SuggestionSummary 
          total={suggestions.length}
          accepted={acceptedSuggestions.size}
          rejected={rejectedSuggestions.size}
        />
      </div>

      {Object.entries(categorizedSuggestions).map(([category, categorySuggestions]) => (
        <div key={category} className="space-y-3">
          <div className="flex items-center gap-2">
            {getCategoryIcon(category)}
            <h4 className="font-medium capitalize">{category.replace('-', ' ')} Suggestions</h4>
            <Badge variant="outline">{categorySuggestions.length}</Badge>
          </div>

          <div className="space-y-3">
            {categorySuggestions.map((suggestion) => {
              const globalIndex = suggestions.findIndex(s => s === suggestion);
              const isExpanded = expandedCards.has(globalIndex);
              const isAccepted = acceptedSuggestions.has(globalIndex);
              const isRejected = rejectedSuggestions.has(globalIndex);

              return (
                <SuggestionCard
                  key={globalIndex}
                  suggestion={suggestion}
                  index={globalIndex}
                  isExpanded={isExpanded}
                  isAccepted={isAccepted}
                  isRejected={isRejected}
                  onToggleExpanded={() => toggleExpanded(globalIndex)}
                  onAccept={() => handleAccept(globalIndex)}
                  onReject={() => handleReject(globalIndex)}
                  onViewDetails={() => onViewDetails?.(globalIndex)}
                />
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

interface SuggestionCardProps {
  suggestion: AISchemaAnalysis['suggestions'][0];
  index: number;
  isExpanded: boolean;
  isAccepted: boolean;
  isRejected: boolean;
  onToggleExpanded: () => void;
  onAccept: () => void;
  onReject: () => void;
  onViewDetails: () => void;
}

function SuggestionCard({
  suggestion,
  isExpanded,
  isAccepted,
  isRejected,
  onToggleExpanded,
  onAccept,
  onReject,
  onViewDetails,
}: SuggestionCardProps) {
  const typeIcon = getTypeIcon(suggestion.type);

  return (
    <Card className={`transition-all duration-200 ${
      isAccepted ? 'border-green-200 bg-green-50' : 
      isRejected ? 'border-red-200 bg-red-50' : 
      'hover:shadow-md'
    }`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3 flex-1">
            <div className="mt-1">
              {typeIcon}
            </div>
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="text-xs">
                  {suggestion.type.replace('-', ' ')}
                </Badge>
                <Badge 
                  variant={suggestion.impact === 'high' ? 'default' : 
                           suggestion.impact === 'medium' ? 'secondary' : 'outline'}
                  className="text-xs"
                >
                  {suggestion.impact} impact
                </Badge>
                {suggestion.actionable && (
                  <Badge variant="outline" className="text-xs text-green-600">
                    <Target className="h-3 w-3 mr-1" />
                    Actionable
                  </Badge>
                )}
              </div>
              <p className="text-sm font-medium leading-relaxed">
                {suggestion.description}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 ml-2">
            {!isAccepted && !isRejected && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onToggleExpanded}
                  className="h-8 w-8 p-0"
                >
                  {isExpanded ? 
                    <ChevronUp className="h-4 w-4" /> : 
                    <ChevronDown className="h-4 w-4" />
                  }
                </Button>
              </>
            )}
            
            {isAccepted && <CheckCircle className="h-5 w-5 text-green-500" />}
            {isRejected && <XCircle className="h-5 w-5 text-red-500" />}
          </div>
        </div>
      </CardHeader>

      {(isExpanded || isAccepted || isRejected) && (
        <CardContent className="pt-0">
          <div className="space-y-4">
            {/* Reasoning */}
            <div className="space-y-2">
              <h5 className="text-sm font-medium">Reasoning</h5>
              <p className="text-sm text-gray-600 leading-relaxed">
                {suggestion.reasoning}
              </p>
            </div>

            {/* Impact Details */}
            <ImpactDetails impact={suggestion.impact} />

            {/* Action Buttons */}
            {!isAccepted && !isRejected && (
              <div className="flex gap-2 pt-2">
                <Button
                  size="sm"
                  onClick={onAccept}
                  className="flex items-center gap-2"
                >
                  <CheckCircle className="h-4 w-4" />
                  Accept
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onReject}
                  className="flex items-center gap-2"
                >
                  <XCircle className="h-4 w-4" />
                  Reject
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={onViewDetails}
                  className="flex items-center gap-2"
                >
                  View Details
                </Button>
              </div>
            )}

            {/* Status Message */}
            {isAccepted && (
              <div className="flex items-center gap-2 text-sm text-green-600 bg-green-100 p-2 rounded">
                <CheckCircle className="h-4 w-4" />
                This suggestion has been accepted and will be applied to your schema.
              </div>
            )}

            {isRejected && (
              <div className="flex items-center gap-2 text-sm text-red-600 bg-red-100 p-2 rounded">
                <XCircle className="h-4 w-4" />
                This suggestion has been rejected and will not be applied.
              </div>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

interface SuggestionSummaryProps {
  total: number;
  accepted: number;
  rejected: number;
}

function SuggestionSummary({ total, accepted, rejected }: SuggestionSummaryProps) {
  const pending = total - accepted - rejected;
  
  return (
    <div className="flex items-center gap-4 text-sm">
      <div className="flex items-center gap-1">
        <div className="w-2 h-2 bg-blue-500 rounded-full" />
        <span>{pending} pending</span>
      </div>
      <div className="flex items-center gap-1">
        <div className="w-2 h-2 bg-green-500 rounded-full" />
        <span>{accepted} accepted</span>
      </div>
      <div className="flex items-center gap-1">
        <div className="w-2 h-2 bg-red-500 rounded-full" />
        <span>{rejected} rejected</span>
      </div>
    </div>
  );
}

interface ImpactDetailsProps {
  impact: 'low' | 'medium' | 'high';
}

function ImpactDetails({ impact }: ImpactDetailsProps) {
  const details = getImpactDetails(impact);
  
  return (
    <div className="space-y-2">
      <h5 className="text-sm font-medium">Expected Impact</h5>
      <div className="bg-gray-50 p-3 rounded border">
        <div className="flex items-center gap-2 mb-2">
          <TrendingUp className={`h-4 w-4 ${getImpactColor(impact)}`} />
          <span className="font-medium text-sm capitalize">{impact} Impact</span>
        </div>
        <ul className="text-sm text-gray-600 space-y-1">
          {details.map((detail, index) => (
            <li key={index} className="flex items-start gap-1">
              <span className="text-gray-400">•</span>
              <span>{detail}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// Utility functions
function categorizeSuggestions(suggestions: AISchemaAnalysis['suggestions']) {
  return suggestions.reduce((categories, suggestion) => {
    const category = suggestion.type;
    if (!categories[category]) {
      categories[category] = [];
    }
    categories[category].push(suggestion);
    return categories;
  }, {} as Record<string, AISchemaAnalysis['suggestions']>);
}

function getCategoryIcon(category: string) {
  switch (category) {
    case 'optimization':
      return <Zap className="h-4 w-4 text-blue-500" />;
    case 'normalization':
      return <Database className="h-4 w-4 text-green-500" />;
    case 'data-quality':
      return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    case 'best-practice':
      return <Shield className="h-4 w-4 text-purple-500" />;
    default:
      return <Lightbulb className="h-4 w-4 text-gray-500" />;
  }
}

function getTypeIcon(type: string) {
  switch (type) {
    case 'optimization':
      return <Zap className="h-5 w-5 text-blue-500" />;
    case 'normalization':
      return <Database className="h-5 w-5 text-green-500" />;
    case 'data-quality':
      return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
    case 'best-practice':
      return <Shield className="h-5 w-5 text-purple-500" />;
    default:
      return <Lightbulb className="h-5 w-5 text-gray-500" />;
  }
}

function getImpactColor(impact: 'low' | 'medium' | 'high'): string {
  switch (impact) {
    case 'high':
      return 'text-red-500';
    case 'medium':
      return 'text-yellow-500';
    case 'low':
      return 'text-green-500';
  }
}

function getImpactDetails(impact: 'low' | 'medium' | 'high'): string[] {
  switch (impact) {
    case 'high':
      return [
        'Significant performance or functionality improvement',
        'May require substantial schema changes',
        'Recommended for production systems',
        'Could affect existing queries or applications',
      ];
    case 'medium':
      return [
        'Moderate improvement to schema quality',
        'Relatively safe to implement',
        'Good balance of benefit vs. complexity',
        'Minor impact on existing code',
      ];
    case 'low':
      return [
        'Small but valuable improvement',
        'Easy to implement with minimal risk',
        'Good for code quality and maintainability',
        'No breaking changes expected',
      ];
  }
}