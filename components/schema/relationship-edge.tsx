"use client"

import React, { memo } from 'react';
import {
  EdgeProps,
  getBezierPath,
  EdgeLabelRenderer,
  BaseEdge,
  MarkerType,
} from '@xyflow/react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import { Relationship } from '@/types/schema.types';
import { 
  MoreVertical, 
  Trash2, 
  Edit3, 
  ArrowRight,
  AlertCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface RelationshipEdgeData extends Record<string, unknown> {
  relationship: Relationship;
  onRelationshipChange?: (relationship: Relationship) => void;
  onRelationshipDelete?: (relationshipId: string) => void;
  selected?: boolean;
  readOnly?: boolean;
}

export interface RelationshipEdgeProps extends EdgeProps {
  data: RelationshipEdgeData;
}

// Relationship type indicators
const getRelationshipIndicator = (type: string) => {
  switch (type) {
    case 'one-to-one':
      return { symbol: '1:1', color: 'text-blue-600' };
    case 'one-to-many':
      return { symbol: '1:N', color: 'text-green-600' };
    case 'many-to-many':
      return { symbol: 'N:M', color: 'text-purple-600' };
    default:
      return { symbol: '?', color: 'text-gray-600' };
  }
};

// Get marker end based on relationship type
const getMarkerEnd = (type: string, selected: boolean) => {
  const color = selected ? '#3b82f6' : '#6b7280';
  
  switch (type) {
    case 'one-to-one':
      return {
        type: MarkerType.ArrowClosed,
        color,
        width: 16,
        height: 16,
      };
    case 'one-to-many':
      return {
        type: MarkerType.ArrowClosed,
        color,
        width: 20,
        height: 16,
      };
    case 'many-to-many':
      return {
        type: MarkerType.ArrowClosed,
        color,
        width: 20,
        height: 20,
      };
    default:
      return {
        type: MarkerType.Arrow,
        color,
        width: 16,
        height: 16,
      };
  }
};

const RelationshipEdge = memo(({
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
}: RelationshipEdgeProps) => {
  const { relationship, onRelationshipDelete, readOnly } = data;

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const handleDeleteRelationship = () => {
    if (readOnly || !onRelationshipDelete) return;
    onRelationshipDelete(relationship.id);
  };

  const handleEditRelationship = () => {
    // This will be handled by the schema editor panel when the edge is selected
    console.log('Edit relationship:', relationship.id);
  };

  const relationshipIndicator = getRelationshipIndicator(relationship.type);
  const customMarkerEnd = getMarkerEnd(relationship.type, selected || false);

  // Check if relationship has validation errors
  const hasErrors = false; // TODO: Implement based on validation result

  return (
    <>
      <BaseEdge
        path={edgePath}
        markerEnd={`url(#${customMarkerEnd.type}-${customMarkerEnd.color.replace('#', '')})`}
        style={{
          stroke: selected ? '#3b82f6' : hasErrors ? '#ef4444' : '#6b7280',
          strokeWidth: selected ? 3 : hasErrors ? 2.5 : 2,
          strokeDasharray: hasErrors ? '5,5' : undefined,
        }}
        className={cn(
          "transition-all duration-200",
          selected ? "drop-shadow-lg" : "hover:stroke-blue-400"
        )}
      />

      <defs>
        <marker
          id={`${customMarkerEnd.type}-${customMarkerEnd.color.replace('#', '')}`}
          markerWidth={customMarkerEnd.width}
          markerHeight={customMarkerEnd.height}
          refX={customMarkerEnd.width - 2}
          refY={customMarkerEnd.height / 2}
          orient="auto"
          markerUnits="strokeWidth"
        >
          <path
            d={`M0,0 L0,${customMarkerEnd.height} L${customMarkerEnd.width},${customMarkerEnd.height / 2} z`}
            fill={customMarkerEnd.color}
            stroke={customMarkerEnd.color}
            strokeWidth="1"
          />
        </marker>
      </defs>

      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            fontSize: 12,
            pointerEvents: 'all',
          }}
          className="nodrag nopan"
        >
          <div 
            className={cn(
              "flex items-center gap-2 bg-white rounded-lg shadow-md border px-2 py-1 transition-all duration-200",
              selected ? "ring-2 ring-blue-500 border-blue-300" : "hover:shadow-lg",
              hasErrors ? "border-red-300 bg-red-50" : "border-gray-200"
            )}
          >
            {/* Relationship type indicator */}
            <Badge 
              variant="outline" 
              className={cn("text-xs px-1.5 py-0", relationshipIndicator.color)}
            >
              {relationshipIndicator.symbol}
            </Badge>

            {/* Column relationship info */}
            <div className="flex items-center gap-1 text-xs text-gray-600">
              <span className="font-medium">{relationship.sourceColumn}</span>
              <ArrowRight className="h-3 w-3" />
              <span className="font-medium">{relationship.targetColumn}</span>
            </div>

            {/* Error indicator */}
            {hasErrors && (
              <AlertCircle className="h-3 w-3 text-red-500" />
            )}

            {/* Actions dropdown */}
            {!readOnly && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-5 w-5 p-0 hover:bg-gray-100"
                  >
                    <MoreVertical className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleEditRelationship}>
                    <Edit3 className="h-4 w-4 mr-2" />
                    Edit Relationship
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    onClick={handleDeleteRelationship}
                    className="text-red-600 focus:text-red-600"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          {/* Relationship metadata tooltip on hover */}
          {(relationship.onDelete || relationship.onUpdate) && (
            <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-1 opacity-0 hover:opacity-100 transition-opacity">
              <div className="bg-gray-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap">
                {relationship.onDelete && `ON DELETE ${relationship.onDelete}`}
                {relationship.onDelete && relationship.onUpdate && ' · '}
                {relationship.onUpdate && `ON UPDATE ${relationship.onUpdate}`}
              </div>
            </div>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  );
});

RelationshipEdge.displayName = 'RelationshipEdge';

export { RelationshipEdge };