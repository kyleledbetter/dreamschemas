'use client';

import React from 'react';
import { Badge } from '../ui/badge';
import { Card, CardContent } from '../ui/card';
import { CheckCircle, AlertTriangle, XCircle, TrendingUp, TrendingDown } from 'lucide-react';
import { CONFIDENCE_THRESHOLDS } from '../../lib/ai/schema-analyzer';

interface ConfidenceScoreProps {
  score: number;
  label?: string;
  showDetails?: boolean;
  reasoning?: string;
  className?: string;
}

export function ConfidenceScore({ 
  score, 
  label = "Confidence", 
  showDetails = false, 
  reasoning,
  className = "" 
}: ConfidenceScoreProps) {
  const percentage = Math.round(score * 100);
  const level = getConfidenceLevel(score);
  
  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{label}</span>
        <div className="flex items-center gap-2">
          {getConfidenceIcon(level)}
          <Badge variant={getConfidenceBadgeVariant(level)}>
            {percentage}%
          </Badge>
        </div>
      </div>
      
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className={`h-2 rounded-full transition-all duration-300 ${getConfidenceBarColor(level)}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      
      {showDetails && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-600">Level:</span>
            <Badge variant="outline" className={getConfidenceTextColor(level)}>
              {level.toUpperCase()}
            </Badge>
          </div>
          
          {reasoning && (
            <p className="text-xs text-gray-600 italic">{reasoning}</p>
          )}
          
          <ConfidenceBreakdown score={score} />
        </div>
      )}
    </div>
  );
}

interface ConfidenceBreakdownProps {
  score: number;
}

function ConfidenceBreakdown({ score }: ConfidenceBreakdownProps) {
  const recommendations = getConfidenceRecommendations(score);
  
  return (
    <div className="space-y-2">
      <h5 className="text-xs font-medium text-gray-700">What this means:</h5>
      <ul className="text-xs text-gray-600 space-y-1">
        {recommendations.map((rec, index) => (
          <li key={index} className="flex items-start gap-1">
            <span className="text-gray-400">•</span>
            <span>{rec}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

interface MultiConfidenceDisplayProps {
  scores: Array<{
    label: string;
    score: number;
    reasoning?: string;
    category?: string;
  }>;
  showAverage?: boolean;
  className?: string;
}

export function MultiConfidenceDisplay({ 
  scores, 
  showAverage = true, 
  className = "" 
}: MultiConfidenceDisplayProps) {
  const averageScore = scores.reduce((sum, item) => sum + item.score, 0) / scores.length;
  const groupedScores = groupScoresByCategory(scores);
  
  return (
    <Card className={className}>
      <CardContent className="p-4 space-y-4">
        {showAverage && (
          <div className="pb-3 border-b">
            <ConfidenceScore 
              score={averageScore} 
              label="Overall Confidence"
              showDetails={true}
            />
          </div>
        )}
        
        {Object.entries(groupedScores).map(([category, categoryScores]) => (
          <div key={category} className="space-y-3">
            {category !== 'default' && (
              <h4 className="text-sm font-medium text-gray-700 capitalize">
                {category} Analysis
              </h4>
            )}
            
            <div className="space-y-2">
              {categoryScores.map((item, index) => (
                <ConfidenceScore
                  key={index}
                  score={item.score}
                  label={item.label}
                  {...(item.reasoning ? { reasoning: item.reasoning } : {})}
                />
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

interface ConfidenceComparisonProps {
  before: number;
  after: number;
  label?: string;
  changeDescription?: string;
}

export function ConfidenceComparison({ 
  before, 
  after, 
  label = "Confidence Change",
  changeDescription 
}: ConfidenceComparisonProps) {
  const change = after - before;
  const isImprovement = change > 0;
  const isSignificantChange = Math.abs(change) > 0.1; // 10% threshold
  
  return (
    <div className="space-y-3 p-3 border rounded-lg">
      <div className="flex items-center justify-between">
        <span className="font-medium text-sm">{label}</span>
        <div className="flex items-center gap-2">
          {isSignificantChange && (
            isImprovement ? 
              <TrendingUp className="h-4 w-4 text-green-500" /> :
              <TrendingDown className="h-4 w-4 text-red-500" />
          )}
          <Badge variant={isImprovement ? "default" : "destructive"}>
            {change > 0 ? '+' : ''}{Math.round(change * 100)}%
          </Badge>
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <span className="text-gray-600">Before:</span>
          <div className="mt-1">
            <ConfidenceScore score={before} label="" />
          </div>
        </div>
        <div>
          <span className="text-gray-600">After:</span>
          <div className="mt-1">
            <ConfidenceScore score={after} label="" />
          </div>
        </div>
      </div>
      
      {changeDescription && (
        <p className="text-xs text-gray-600 italic">{changeDescription}</p>
      )}
    </div>
  );
}

// Utility functions
function getConfidenceLevel(score: number): 'high' | 'medium' | 'low' {
  if (score >= CONFIDENCE_THRESHOLDS.HIGH) return 'high';
  if (score >= CONFIDENCE_THRESHOLDS.MEDIUM) return 'medium';
  return 'low';
}

function getConfidenceIcon(level: 'high' | 'medium' | 'low') {
  switch (level) {
    case 'high':
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    case 'medium':
      return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    case 'low':
      return <XCircle className="h-4 w-4 text-red-500" />;
  }
}

function getConfidenceBadgeVariant(level: 'high' | 'medium' | 'low'): "default" | "secondary" | "destructive" | "outline" {
  switch (level) {
    case 'high':
      return 'default';
    case 'medium':
      return 'secondary';
    case 'low':
      return 'destructive';
  }
}

function getConfidenceBarColor(level: 'high' | 'medium' | 'low'): string {
  switch (level) {
    case 'high':
      return 'bg-green-500';
    case 'medium':
      return 'bg-yellow-500';
    case 'low':
      return 'bg-red-500';
  }
}

function getConfidenceTextColor(level: 'high' | 'medium' | 'low'): string {
  switch (level) {
    case 'high':
      return 'text-green-700';
    case 'medium':
      return 'text-yellow-700';
    case 'low':
      return 'text-red-700';
  }
}

function getConfidenceRecommendations(score: number): string[] {
  if (score >= CONFIDENCE_THRESHOLDS.HIGH) {
    return [
      'High confidence - recommendations are likely accurate',
      'Schema should be production-ready with minimal changes',
      'Consider proceeding with the suggested structure',
    ];
  } else if (score >= CONFIDENCE_THRESHOLDS.MEDIUM) {
    return [
      'Medium confidence - recommendations need review',
      'Verify column types and relationships manually',
      'Consider refining with additional context or data samples',
    ];
  } else {
    return [
      'Low confidence - manual review required',
      'Data may be inconsistent or incomplete',
      'Consider providing more context or cleaning data first',
      'Use as starting point only, not production-ready',
    ];
  }
}

function groupScoresByCategory(scores: Array<{
  label: string;
  score: number;
  reasoning?: string;
  category?: string;
}>): Record<string, Array<{ label: string; score: number; reasoning?: string }>> {
  return scores.reduce((groups, score) => {
    const category = score.category || 'default';
    if (!groups[category]) {
      groups[category] = [];
    }
    groups[category].push({
      label: score.label,
      score: score.score,
      ...(score.reasoning ? { reasoning: score.reasoning } : {}),
    });
    return groups;
  }, {} as Record<string, Array<{ label: string; score: number; reasoning?: string }>>);
}