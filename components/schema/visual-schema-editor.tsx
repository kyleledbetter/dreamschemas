"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn, generateId } from "@/lib/utils";
import type {
  Column,
  DatabaseSchema,
  Relationship,
  Table,
} from "@/types/schema.types";
import {
  Background,
  BackgroundVariant,
  Connection,
  Controls,
  Edge,
  Node,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  Calendar,
  CheckSquare,
  CircleSlash2Icon,
  Crosshair,
  Database,
  Edit,
  FileText,
  Grid,
  Hash,
  Key,
  Link,
  List,
  Plus,
  Settings,
  Table2Icon,
  Target,
  Trash2,
  Type,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTheme } from "next-themes";

// Custom node data types
interface TableNodeData {
  table: Table;
  onEdit: (table: Table) => void;
  onDelete: (tableId: string) => void;
  isSelected: boolean;
}

interface ColumnItemProps {
  column: Column;
  isSelected: boolean;
  onClick: () => void;
}

// Column component for table nodes
function ColumnItem({ column, isSelected, onClick }: ColumnItemProps) {
  const getColumnIcon = (type: string) => {
    const typeIcons = {
      UUID: Key,
      VARCHAR: Type,
      TEXT: FileText,
      INTEGER: Hash,
      BIGINT: Hash,
      DECIMAL: Hash,
      BOOLEAN: CheckSquare,
      TIMESTAMPTZ: Calendar,
      JSONB: FileText,
      JSON: FileText,
    };
    return typeIcons[type] || Type;
  };

  const isPrimaryKey = column.constraints?.some((c) =>
    c.type.includes("PRIMARY KEY")
  );
  const isForeignKey = column.constraints?.some((c) =>
    c.type.includes("FOREIGN KEY")
  );
  const isNullable = column.nullable;

  const Icon = getColumnIcon(column.type);

  return (
    <div
      className={cn(
        "flex items-center gap-2 p-2 rounded text-xs border cursor-pointer transition-colors",
        isSelected
          ? "border-primary/10 bg-primary/2"
          : "border-border hover:border-muted-foreground",
        isPrimaryKey &&
          "bg-primary/2 border-primary/10 text-primary dark:text-accent dark:border-accent dark:bg-accent/10",
        isForeignKey && "bg-info/2 border-info/10 text-info"
      )}
      onClick={onClick}
    >
      <Icon className="h-3 w-3 text-muted-foreground" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1">
          <span
            className={cn(
              "font-medium truncate",
              isPrimaryKey && "text-primary dark:text-accent",
              isForeignKey && "text-blue-700"
            )}
          >
            {column.name}
          </span>
          {isPrimaryKey && <Key className="h-2 w-2 text-yellow-600" />}
          {isForeignKey && <Link className="h-2 w-2 text-blue-600" />}
        </div>
      </div>
      <div className="flex items-center gap-1 text-muted-foreground">
        <span className="text-[9px]">{column.type}</span>
        {column.length && <span className="text-[9px]">({column.length})</span>}
        {!isNullable && (
          <span className="text-muted-foreground">
            <CircleSlash2Icon className="size-2" />
          </span>
        )}
      </div>
    </div>
  );
}

// Custom table node component
function TableNode({ data }: { data: TableNodeData }) {
  const { table, onEdit, onDelete, isSelected } = data;

  return (
    <Card
      className={cn(
        "min-w-[280px] transition-all p-0",
        isSelected && "ring-2 ring-primary"
      )}
    >
      <CardHeader className="py-2 px-3 bg-card">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Table2Icon className="size-4 text-muted-foreground" />
            <CardTitle className="text-sm">{table.name}</CardTitle>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={() => onEdit(table)}
            >
              <Edit className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={() => onDelete(table.id)}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>
        {table.comment && (
          <p className="text-xs text-muted-foreground">{table.comment}</p>
        )}
      </CardHeader>

      <CardContent className="pt-0 px-3">
        <div className="space-y-1 max-h-64 overflow-y-auto">
          {table.columns.map((column) => (
            <ColumnItem
              key={column.id}
              column={column}
              isSelected={false}
              onClick={() => {
                // Handle column selection if needed
              }}
            />
          ))}
        </div>

        {table.indexes && table.indexes.length > 0 && (
          <div className="mt-3 pt-2 border-t">
            <div className="flex items-center gap-1 mb-2">
              <List className="h-3 w-3 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground">
                Indexes
              </span>
            </div>
            <div className="space-y-1">
              {table.indexes.map((index) => (
                <div key={index.id} className="flex items-center gap-2 text-xs">
                  <Badge
                    variant="outline"
                    className="text-xs text-muted-foreground"
                  >
                    {index.unique ? "UNIQUE" : "INDEX"}
                  </Badge>
                  <span className="text-muted-foreground">
                    {index.columns.join(", ")}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Properties panel for editing tables and columns
interface PropertiesPanelProps {
  selectedTable?: Table;
  selectedColumn?: Column;
  onUpdateTable?: (table: Table) => void;
  onUpdateColumn?: (column: Column) => void;
  onClose?: () => void;
}

function PropertiesPanel({
  selectedTable,
  selectedColumn,
  onUpdateTable,
  onUpdateColumn,
  onClose,
}: PropertiesPanelProps) {
  const [editingTable, setEditingTable] = useState<Table | undefined>(
    selectedTable
  );
  const [editingColumn, setEditingColumn] = useState<Column | undefined>(
    selectedColumn
  );

  useEffect(() => {
    setEditingTable(selectedTable);
    setEditingColumn(selectedColumn);
  }, [selectedTable, selectedColumn]);

  if (!editingTable && !editingColumn) {
    return (
      <Card className="w-80">
        <CardContent className="text-center py-8">
          <Settings className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">
            Select a table or column to edit properties
          </p>
        </CardContent>
      </Card>
    );
  }

  if (editingTable) {
    return (
      <Card className="w-80">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Table Properties</CardTitle>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="table-name">Table Name</Label>
            <Input
              id="table-name"
              value={editingTable.name}
              onChange={(e) =>
                setEditingTable((prev) =>
                  prev ? { ...prev, name: e.target.value } : undefined
                )
              }
            />
          </div>

          <div>
            <Label htmlFor="table-comment">Comment</Label>
            <Input
              id="table-comment"
              value={editingTable.comment || ""}
              onChange={(e) =>
                setEditingTable((prev) =>
                  prev ? { ...prev, comment: e.target.value } : undefined
                )
              }
              placeholder="Optional table description"
            />
          </div>

          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => editingTable && onUpdateTable?.(editingTable)}
              className="flex-1"
            >
              Save Changes
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditingTable(selectedTable)}
              className="flex-1"
            >
              Reset
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (editingColumn) {
    return (
      <Card className="w-80">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Column Properties</CardTitle>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="column-name">Column Name</Label>
            <Input
              id="column-name"
              value={editingColumn.name}
              onChange={(e) =>
                setEditingColumn((prev) =>
                  prev ? { ...prev, name: e.target.value } : undefined
                )
              }
            />
          </div>

          <div>
            <Label htmlFor="column-type">Data Type</Label>
            <Select
              value={editingColumn.type}
              onValueChange={(value) =>
                setEditingColumn((prev) =>
                  prev ? { ...prev, type: value as any } : undefined
                )
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="UUID">UUID</SelectItem>
                <SelectItem value="VARCHAR">VARCHAR</SelectItem>
                <SelectItem value="TEXT">TEXT</SelectItem>
                <SelectItem value="INTEGER">INTEGER</SelectItem>
                <SelectItem value="BIGINT">BIGINT</SelectItem>
                <SelectItem value="DECIMAL">DECIMAL</SelectItem>
                <SelectItem value="BOOLEAN">BOOLEAN</SelectItem>
                <SelectItem value="TIMESTAMPTZ">TIMESTAMPTZ</SelectItem>
                <SelectItem value="JSONB">JSONB</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {(editingColumn.type === "VARCHAR" ||
            editingColumn.type === "CHAR") && (
            <div>
              <Label htmlFor="column-length">Length</Label>
              <Input
                id="column-length"
                type="number"
                value={editingColumn.length || ""}
                onChange={(e) =>
                  setEditingColumn((prev) =>
                    prev
                      ? {
                          ...prev,
                          length: e.target.value
                            ? parseInt(e.target.value)
                            : undefined,
                        }
                      : undefined
                  )
                }
              />
            </div>
          )}

          <div className="flex items-center space-x-2">
            <Checkbox
              id="nullable"
              checked={editingColumn.nullable}
              onCheckedChange={(checked) =>
                setEditingColumn((prev) =>
                  prev
                    ? {
                        ...prev,
                        nullable: checked as boolean,
                      }
                    : undefined
                )
              }
            />
            <Label htmlFor="nullable">Nullable</Label>
          </div>

          <div>
            <Label htmlFor="default-value">Default Value</Label>
            <Input
              id="default-value"
              value={editingColumn.defaultValue || ""}
              onChange={(e) =>
                setEditingColumn((prev) =>
                  prev
                    ? {
                        ...prev,
                        defaultValue: e.target.value || undefined,
                      }
                    : undefined
                )
              }
              placeholder="e.g., NOW(), gen_random_uuid()"
            />
          </div>

          <div>
            <Label htmlFor="column-comment">Comment</Label>
            <Input
              id="column-comment"
              value={editingColumn.comment || ""}
              onChange={(e) =>
                setEditingColumn((prev) =>
                  prev
                    ? {
                        ...prev,
                        comment: e.target.value || undefined,
                      }
                    : undefined
                )
              }
              placeholder="Optional column description"
            />
          </div>

          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => editingColumn && onUpdateColumn?.(editingColumn)}
              className="flex-1"
            >
              Save Changes
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditingColumn(selectedColumn)}
              className="flex-1"
            >
              Reset
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return null;
}

// Main visual schema editor component
interface VisualSchemaEditorProps {
  schema: DatabaseSchema;
  onSchemaChange: (schema: DatabaseSchema) => void;
  className?: string;
  readonly?: boolean;
}

function VisualSchemaEditorComponent({
  schema,
  onSchemaChange,
  className = "",
  readonly = false,
}: VisualSchemaEditorProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedTable, setSelectedTable] = useState<Table | undefined>();
  const [selectedColumn, setSelectedColumn] = useState<Column | undefined>();
  const [showPropertiesPanel, setShowPropertiesPanel] = useState(false);
  const [isCreatingRelationship, setIsCreatingRelationship] = useState(false);
  const { theme } = useTheme();

  const { fitView, setCenter, zoomIn, zoomOut } = useReactFlow();

  // Node types for React Flow
  const nodeTypes = useMemo(
    () => ({
      table: TableNode,
    }),
    []
  );

  // Convert schema to React Flow nodes
  useEffect(() => {
    const newNodes: Node[] = schema.tables.map((table, index) => ({
      id: table.id,
      type: "table",
      position: table.position || {
        x: (index % 3) * 350 + 50,
        y: Math.floor(index / 3) * 250 + 50,
      },
      data: {
        table,
        onEdit: (table: Table) => {
          setSelectedTable(table);
          setSelectedColumn(undefined);
          setShowPropertiesPanel(true);
        },
        onDelete: (tableId: string) => {
          if (!readonly) {
            const updatedSchema = {
              ...schema,
              tables: schema.tables.filter((t) => t.id !== tableId),
              relationships:
                schema.relationships?.filter(
                  (r) =>
                    r.sourceTable !== table.name && r.targetTable !== table.name
                ) || [],
            };
            onSchemaChange(updatedSchema);
          }
        },
        isSelected: selectedTable?.id === table.id,
      } as TableNodeData,
    }));

    setNodes(newNodes);
  }, [schema.tables, selectedTable, readonly, onSchemaChange]);

  // Convert relationships to React Flow edges
  useEffect(() => {
    if (!schema.relationships) return;

    const newEdges: Edge[] = schema.relationships.map((relationship) => {
      const sourceTable = schema.tables.find(
        (t) => t.name === relationship.sourceTable
      );
      const targetTable = schema.tables.find(
        (t) => t.name === relationship.targetTable
      );

      return {
        id: relationship.id,
        source: sourceTable?.id || "",
        target: targetTable?.id || "",
        type: "smoothstep",
        animated: false,
        label: relationship.type,
        style: {
          stroke: "#6b7280",
          strokeWidth: 2,
        },
        markerEnd: {
          type: "arrowclosed",
          color: "#6b7280",
        },
        data: { relationship },
      };
    });

    setEdges(newEdges);
  }, [schema.relationships, schema.tables]);

  // Handle edge connections (creating relationships)
  const onConnect = useCallback(
    (params: Connection) => {
      if (readonly) return;

      const sourceTable = schema.tables.find((t) => t.id === params.source);
      const targetTable = schema.tables.find((t) => t.id === params.target);

      if (sourceTable && targetTable) {
        const newRelationship: Relationship = {
          id: generateId(),
          name: `${sourceTable.name}_${targetTable.name}_fkey`,
          sourceTable: sourceTable.name,
          sourceColumn: "id", // Default, should be configurable
          targetTable: targetTable.name,
          targetColumn: "id", // Default, should be configurable
          type: "one-to-many",
          onDelete: "CASCADE",
        };

        const updatedSchema = {
          ...schema,
          relationships: [...(schema.relationships || []), newRelationship],
        };

        onSchemaChange(updatedSchema);
      }
    },
    [schema, onSchemaChange, readonly]
  );

  // Handle node position changes
  const onNodeDragStop = useCallback(
    (_: any, node: Node) => {
      if (readonly) return;

      const updatedTables = schema.tables.map((table) =>
        table.id === node.id ? { ...table, position: node.position } : table
      );

      onSchemaChange({
        ...schema,
        tables: updatedTables,
      });
    },
    [schema, onSchemaChange, readonly]
  );

  // Add new table
  const addNewTable = useCallback(() => {
    if (readonly) return;

    const newTable: Table = {
      id: generateId(),
      name: `table_${schema.tables.length + 1}`,
      comment: "New table",
      position: {
        x: 100 + schema.tables.length * 50,
        y: 100 + schema.tables.length * 50,
      },
      columns: [
        {
          id: generateId(),
          name: "id",
          type: "UUID",
          nullable: false,
          defaultValue: "gen_random_uuid()",
          constraints: [{ type: "PRIMARY KEY" }],
          comment: "Primary key",
        },
        {
          id: generateId(),
          name: "created_at",
          type: "TIMESTAMPTZ",
          nullable: false,
          defaultValue: "NOW()",
          constraints: [{ type: "NOT NULL" }],
          comment: "Creation timestamp",
        },
        {
          id: generateId(),
          name: "updated_at",
          type: "TIMESTAMPTZ",
          nullable: false,
          defaultValue: "NOW()",
          constraints: [{ type: "NOT NULL" }],
          comment: "Update timestamp",
        },
      ],
      indexes: [
        {
          id: generateId(),
          name: `idx_table_${schema.tables.length + 1}_created_at`,
          columns: ["created_at"],
          unique: false,
        },
      ],
    };

    onSchemaChange({
      ...schema,
      tables: [...schema.tables, newTable],
    });
  }, [schema, onSchemaChange, readonly]);

  // Update table from properties panel
  const handleUpdateTable = useCallback(
    (updatedTable: Table) => {
      const updatedTables = schema.tables.map((table) =>
        table.id === updatedTable.id ? updatedTable : table
      );

      onSchemaChange({
        ...schema,
        tables: updatedTables,
      });

      setSelectedTable(updatedTable);
    },
    [schema, onSchemaChange]
  );

  // Auto-layout tables
  const autoLayout = useCallback(() => {
    const updatedTables = schema.tables.map((table, index) => ({
      ...table,
      position: {
        x: (index % 4) * 350 + 50,
        y: Math.floor(index / 4) * 300 + 50,
      },
    }));

    onSchemaChange({
      ...schema,
      tables: updatedTables,
    });

    setTimeout(() => fitView(), 100);
  }, [schema, onSchemaChange, fitView]);

  const proOptions = { hideAttribution: true };

  return (
    <div className={cn("h-full w-full flex", className)}>
      {/* Main editor area */}
      <div className="flex-1 relative">
        <ReactFlow
          colorMode={theme === "light" ? "light" : "dark"}
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeDragStop={onNodeDragStop}
          nodeTypes={nodeTypes}
          fitView
          className="bg-gray-50"
          nodesDraggable={!readonly}
          nodesConnectable={!readonly}
          elementsSelectable={!readonly}
          proOptions={proOptions}
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
          <Controls />

          {/* Toolbar Panel */}
          <Panel position="top-left" className="space-x-2">
            {!readonly && (
              <>
                <Button size="sm" onClick={addNewTable} className="gap-2">
                  <Plus className="size-4" />
                  Add Table
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setIsCreatingRelationship(!isCreatingRelationship)
                  }
                  className={cn(
                    "gap-2",
                    isCreatingRelationship &&
                      "bg-primary text-primary-foreground"
                  )}
                >
                  <Link className="size-4" />
                  Connect
                </Button>
              </>
            )}

            <Button
              size="sm"
              variant="outline"
              onClick={autoLayout}
              className="gap-2"
            >
              <Grid className="size-4" />
              Auto Layout
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={() => fitView()}
              className="gap-2"
            >
              <Crosshair className="size-4" />
              Fit View
            </Button>
          </Panel>

          {/* Schema Info Panel */}
          <Panel position="top-right">
            <Card className="min-w-[200px]">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">{schema.name}</CardTitle>
              </CardHeader>
              <CardContent className="text-xs space-y-1">
                <div className="flex justify-between">
                  <span>Tables:</span>
                  <Badge variant="outline">{schema.tables.length}</Badge>
                </div>
                <div className="flex justify-between">
                  <span>Relationships:</span>
                  <Badge variant="outline">
                    {schema.relationships?.length || 0}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span>Columns:</span>
                  <Badge variant="outline">
                    {schema.tables.reduce(
                      (acc, table) => acc + table.columns.length,
                      0
                    )}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </Panel>

          {isCreatingRelationship && (
            <Panel position="bottom-center">
              <Card>
                <CardContent className="p-3">
                  <div className="flex items-center gap-2 text-sm">
                    <Target className="h-4 w-4 text-blue-600" />
                    <span>
                      Click and drag between table nodes to create relationships
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setIsCreatingRelationship(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </Panel>
          )}
        </ReactFlow>
      </div>

      {/* Properties panel */}
      {showPropertiesPanel && (
        <div className="border-l bg-background p-4">
          <PropertiesPanel
            selectedTable={selectedTable}
            selectedColumn={selectedColumn}
            onUpdateTable={handleUpdateTable}
            onUpdateColumn={(updatedColumn) => {
              // Handle column updates
              console.log("Update column:", updatedColumn);
            }}
            onClose={() => {
              setShowPropertiesPanel(false);
              setSelectedTable(undefined);
              setSelectedColumn(undefined);
            }}
          />
        </div>
      )}
    </div>
  );
}

// Wrapper component to provide ReactFlow context
export function VisualSchemaEditor(props: VisualSchemaEditorProps) {
  return (
    <ReactFlowProvider>
      <VisualSchemaEditorComponent {...props} />
    </ReactFlowProvider>
  );
}
