"use client"

import React, { useCallback, useMemo, useState, useRef, useEffect } from 'react';
import {
  ReactFlow,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  Connection,
  Edge,
  Node,
  ReactFlowProvider,
  Panel,
  MiniMap,
  NodeTypes,
  EdgeTypes,
  ReactFlowInstance,
  BackgroundVariant,
  ConnectionLineType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { 
  Table, 
  DatabaseSchema, 
  Relationship, 
  SchemaValidationResult
} from '@/types/schema.types';
import { validateSchema } from '@/lib/utils/validation';
import { 
  Maximize2, 
  Minimize2, 
  Grid, 
  Layers, 
  AlertTriangle,
  CheckCircle,
  PanelLeft,
  PanelLeftClose
} from 'lucide-react';

import { TableNode } from './table-node';
import { RelationshipEdge } from './relationship-edge';
import { SchemaEditorPanel } from './schema-editor-panel';
import { autoLayoutTables } from './layout-algorithm';

// Custom node types
const nodeTypes: NodeTypes = {
  table: TableNode,
};

// Custom edge types  
const edgeTypes: EdgeTypes = {
  relationship: RelationshipEdge,
};

export interface SchemaVisualizerProps {
  schema: DatabaseSchema;
  onSchemaChange: (schema: DatabaseSchema) => void;
  className?: string;
  readOnly?: boolean;
}

interface SchemaVisualizerState {
  selectedNode: string | null;
  selectedEdge: string | null;
  showMiniMap: boolean;
  showGrid: boolean;
  sidebarOpen: boolean;
  validationResult: SchemaValidationResult | null;
  isFullscreen: boolean;
  isMobile: boolean;
  sidebarCollapsed: boolean;
}

export function SchemaVisualizer({
  schema,
  onSchemaChange,
  className = '',
  readOnly = false
}: SchemaVisualizerProps) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);
  
  const [state, setState] = useState<SchemaVisualizerState>({
    selectedNode: null,
    selectedEdge: null,
    showMiniMap: true,
    showGrid: true,
    sidebarOpen: true,
    validationResult: null,
    isFullscreen: false,
    isMobile: false,
    sidebarCollapsed: false,
  });

  // Handle window resize and mobile detection
  useEffect(() => {
    const handleResize = () => {
      const isMobile = window.innerWidth < 768;
      setState(prev => ({
        ...prev,
        isMobile,
        showMiniMap: !isMobile && prev.showMiniMap,
        sidebarOpen: !isMobile && prev.sidebarOpen,
      }));
    };

    handleResize(); // Initial check
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Convert schema tables to React Flow nodes
  const initialNodes = useMemo(() => {
    return schema.tables.map((table): Node => ({
      id: table.id,
      type: 'table',
      position: table.position || { x: 0, y: 0 },
      data: { 
        table,
        onTableChange: readOnly ? undefined : (updatedTable: Table) => {
          const updatedSchema = {
            ...schema,
            tables: schema.tables.map(t => t.id === updatedTable.id ? updatedTable : t),
            updatedAt: new Date()
          };
          onSchemaChange(updatedSchema);
        },
        onTableDelete: readOnly ? undefined : (tableId: string) => {
          const updatedSchema = {
            ...schema,
            tables: schema.tables.filter(t => t.id !== tableId),
            relationships: schema.relationships.filter(r => 
              r.sourceTable !== table.name && r.targetTable !== table.name
            ),
            updatedAt: new Date()
          };
          onSchemaChange(updatedSchema);
        },
        selected: state.selectedNode === table.id,
        readOnly
      },
      draggable: !readOnly,
      selectable: true,
    }));
  }, [schema, state.selectedNode, readOnly, onSchemaChange]);

  // Convert schema relationships to React Flow edges
  const initialEdges = useMemo(() => {
    return schema.relationships.map((relationship): Edge | undefined => {
      const sourceTable = schema.tables.find(t => t.name === relationship.sourceTable);
      const targetTable = schema.tables.find(t => t.name === relationship.targetTable);
      
      if (!sourceTable || !targetTable) {
        console.warn('Relationship references non-existent table:', relationship);
        return undefined;
      }

      return {
        id: relationship.id,
        type: 'relationship',
        source: sourceTable.id,
        target: targetTable.id,
        sourceHandle: `${sourceTable.id}-${relationship.sourceColumn}`,
        targetHandle: `${targetTable.id}-${relationship.targetColumn}`,
        data: {
          relationship,
          onRelationshipChange: readOnly ? undefined : (updatedRelationship: Relationship) => {
            const updatedSchema = {
              ...schema,
              relationships: schema.relationships.map(r => 
                r.id === updatedRelationship.id ? updatedRelationship : r
              ),
              updatedAt: new Date()
            };
            onSchemaChange(updatedSchema);
          },
          onRelationshipDelete: readOnly ? undefined : (relationshipId: string) => {
            const updatedSchema = {
              ...schema,
              relationships: schema.relationships.filter(r => r.id !== relationshipId),
              updatedAt: new Date()
            };
            onSchemaChange(updatedSchema);
          },
          selected: state.selectedEdge === relationship.id,
          readOnly
        },
        animated: false,
        selectable: true,
      };
    }).filter((edge): edge is Edge => edge !== undefined);
  }, [schema, state.selectedEdge, readOnly, onSchemaChange]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Update nodes when schema changes
  React.useEffect(() => {
    setNodes(initialNodes);
  }, [initialNodes, setNodes]);

  // Update edges when schema changes
  React.useEffect(() => {
    setEdges(initialEdges);
  }, [initialEdges, setEdges]);

  // Validate schema whenever it changes
  React.useEffect(() => {
    const validationResult = validateSchema(schema);
    setState(prev => ({ ...prev, validationResult }));
  }, [schema]);

  // Handle connection creation (for relationships)
  const onConnect = useCallback((params: Connection) => {
    if (readOnly) return;

    const sourceNode = nodes.find(n => n.id === params.source);
    const targetNode = nodes.find(n => n.id === params.target);
    
    if (!sourceNode || !targetNode) return;

    const sourceTable = sourceNode.data.table as Table;
    const targetTable = targetNode.data.table as Table;

    // Extract column IDs from handles
    const sourceColumnId = params.sourceHandle?.replace(`${sourceTable.id}-`, '') || '';
    const targetColumnId = params.targetHandle?.replace(`${targetTable.id}-`, '') || '';

    const sourceColumn = sourceTable.columns.find(c => c.id === sourceColumnId);
    const targetColumn = targetTable.columns.find(c => c.id === targetColumnId);

    if (!sourceColumn || !targetColumn) return;

    // Create new relationship
    const newRelationship: Relationship = {
      id: `rel_${Date.now()}`,
      sourceTable: sourceTable.name,
      sourceColumn: sourceColumn.name,
      targetTable: targetTable.name,
      targetColumn: targetColumn.name,
      type: 'one-to-many', // Default, can be changed in editor
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    };

    const updatedSchema = {
      ...schema,
      relationships: [...schema.relationships, newRelationship],
      updatedAt: new Date()
    };

    onSchemaChange(updatedSchema);
  }, [nodes, schema, onSchemaChange, readOnly]);

  // Handle node selection
  const onNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    setState(prev => ({ 
      ...prev, 
      selectedNode: node.id,
      selectedEdge: null 
    }));
  }, []);

  // Handle edge selection
  const onEdgeClick = useCallback((_event: React.MouseEvent, edge: Edge) => {
    setState(prev => ({ 
      ...prev, 
      selectedEdge: edge.id,
      selectedNode: null 
    }));
  }, []);

  // Handle background click (deselect)
  const onPaneClick = useCallback(() => {
    setState(prev => ({ 
      ...prev, 
      selectedNode: null,
      selectedEdge: null 
    }));
  }, []);

  // Auto-layout tables
  const handleAutoLayout = useCallback(() => {
    if (readOnly) return;

    const { nodes: layoutedNodes } = autoLayoutTables(schema.tables, schema.relationships);
    
    const updatedTables = schema.tables.map(table => {
      const layoutedNode = layoutedNodes.find(n => n.id === table.id);
      return layoutedNode ? { ...table, position: layoutedNode.position } : table;
    });

    const updatedSchema = {
      ...schema,
      tables: updatedTables,
      updatedAt: new Date()
    };

    onSchemaChange(updatedSchema);
  }, [schema, onSchemaChange, readOnly]);

  // Fit view to content
  const handleFitView = useCallback(() => {
    if (reactFlowInstance) {
      reactFlowInstance.fitView({ duration: 800 });
    }
  }, [reactFlowInstance]);

  // Toggle fullscreen
  const handleToggleFullscreen = useCallback(() => {
    setState(prev => ({ ...prev, isFullscreen: !prev.isFullscreen }));
  }, []);

  // Get selected table or relationship for editing
  const selectedTable = state.selectedNode ? 
    schema.tables.find(t => t.id === state.selectedNode) : null;
  const selectedRelationship = state.selectedEdge ? 
    schema.relationships.find(r => r.id === state.selectedEdge) : null;

  // Validation summary
  const validationSummary = state.validationResult ? {
    errorCount: state.validationResult.errors.length,
    warningCount: state.validationResult.warnings.length,
    isValid: state.validationResult.isValid
  } : null;

  return (
    <div className={`flex h-full ${state.isFullscreen ? 'fixed inset-0 z-50 bg-background' : ''} ${state.isMobile ? 'flex-col' : ''} ${className}`}>
      <ReactFlowProvider>
        <div className="flex-1 relative">
          <div ref={reactFlowWrapper} style={{ width: '100%', height: '100%' }}>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onNodeClick={onNodeClick}
              onEdgeClick={onEdgeClick}
              onPaneClick={onPaneClick}
              onInit={setReactFlowInstance}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              connectionLineType={ConnectionLineType.SmoothStep}
              defaultEdgeOptions={{
                type: 'relationship',
                animated: false,
              }}
              snapToGrid={true}
              snapGrid={[20, 20]}
              attributionPosition="top-right"
              proOptions={{ hideAttribution: true }}
              minZoom={0.1}
              maxZoom={2}
              deleteKeyCode={readOnly ? null : ['Backspace', 'Delete']}
            >
              <Controls />
              
              {state.showGrid && (
                <Background 
                  variant={BackgroundVariant.Dots} 
                  gap={20} 
                  size={1}
                />
              )}
              
              {state.showMiniMap && (
                <MiniMap
                  nodeStrokeColor="#374151"
                  nodeColor="#f3f4f6"
                  nodeBorderRadius={8}
                  maskColor="rgba(0, 0, 0, 0.1)"
                  position="top-right"
                />
              )}

              {/* Toolbar Panel */}
              <Panel position="top-left" className={`flex gap-2 ${state.isMobile ? 'flex-wrap' : ''}`}>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setState(prev => ({ ...prev, sidebarOpen: !prev.sidebarOpen }))}
                  title={state.isMobile ? "Toggle Menu" : "Toggle Sidebar"}
                >
                  {state.sidebarOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeft className="h-4 w-4" />}
                </Button>
                
                {!readOnly && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleAutoLayout}
                    title="Auto Layout"
                  >
                    <Layers className="h-4 w-4" />
                  </Button>
                )}
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleFitView}
                  title="Fit View"
                >
                  <Maximize2 className="h-4 w-4" />
                </Button>
                
                {!state.isMobile && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setState(prev => ({ ...prev, showGrid: !prev.showGrid }))}
                    title="Toggle Grid"
                  >
                    <Grid className="h-4 w-4" />
                  </Button>
                )}
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleToggleFullscreen}
                  title="Toggle Fullscreen"
                >
                  {state.isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                </Button>
              </Panel>

              {/* Validation Status Panel */}
              {validationSummary && (
                <Panel position="bottom-left" className="flex items-center gap-2">
                  {validationSummary.isValid ? (
                    <Badge variant="default" className="bg-green-100 text-green-800 border-green-200">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Valid Schema
                    </Badge>
                  ) : (
                    <Badge variant="destructive">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      {validationSummary.errorCount} Errors
                    </Badge>
                  )}
                  
                  {validationSummary.warningCount > 0 && (
                    <Badge variant="outline" className="bg-yellow-50 text-yellow-800 border-yellow-200">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      {validationSummary.warningCount} Warnings
                    </Badge>
                  )}
                </Panel>
              )}
            </ReactFlow>
          </div>
        </div>

        {/* Schema Editor Sidebar */}
        {state.sidebarOpen && (
          <div className={cn(
            "bg-background flex-shrink-0 border-l",
            state.isMobile ? (
              state.isFullscreen ? 
                "fixed inset-x-0 bottom-0 top-16 z-50 w-full" :
                "w-full h-1/3 border-t border-l-0"
            ) : "w-80"
          )}>
            <SchemaEditorPanel
              schema={schema}
              onSchemaChange={onSchemaChange}
              selectedTable={selectedTable || null}
              selectedRelationship={selectedRelationship || null}
              validationResult={state.validationResult}
              readOnly={readOnly}
            />
          </div>
        )}
      </ReactFlowProvider>
    </div>
  );
}

export default SchemaVisualizer;