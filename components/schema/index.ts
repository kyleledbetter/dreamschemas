// Main schema visualizer components
export { SchemaVisualizer } from './schema-visualizer';
export type { SchemaVisualizerProps } from './schema-visualizer';

// Node and edge components
export { TableNode } from './table-node';
export type { TableNodeData, TableNodeProps } from './table-node';

export { RelationshipEdge } from './relationship-edge';
export type { RelationshipEdgeData, RelationshipEdgeProps } from './relationship-edge';

// Editor panel
export { SchemaEditorPanel } from './schema-editor-panel';

// Layout utilities
export { 
  autoLayoutTables, 
  suggestLayoutAlgorithm 
} from './layout-algorithm';
export type { 
  LayoutNode, 
  LayoutOptions 
} from './layout-algorithm';

// Re-export validator
export { 
  SchemaValidator, 
  createSchemaValidator, 
  validateElement 
} from '@/lib/schema/validator';