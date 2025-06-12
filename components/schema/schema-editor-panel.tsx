"use client"

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Collapsible, 
  CollapsibleContent, 
  CollapsibleTrigger 
} from '@/components/ui/collapsible';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  DatabaseSchema,
  Table,
  Column,
  Relationship,
  PostgresType,
  SchemaValidationResult
} from '@/types/schema.types';
import {
  ChevronDown,
  ChevronRight,
  Plus,
  Trash2,
  AlertTriangle,
  CheckCircle,
  Info,
  Database,
  Table as TableIcon,
  Link
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface SchemaEditorPanelProps {
  schema: DatabaseSchema;
  onSchemaChange: (schema: DatabaseSchema) => void;
  selectedTable?: Table | null;
  selectedRelationship?: Relationship | null;
  validationResult?: SchemaValidationResult | null;
  readOnly?: boolean;
}

const POSTGRES_TYPES: PostgresType[] = [
  'VARCHAR', 'TEXT', 'CHAR',
  'INTEGER', 'BIGINT', 'SMALLINT', 'NUMERIC', 'DECIMAL', 'REAL', 'DOUBLE PRECISION',
  'BOOLEAN',
  'DATE', 'TIME', 'TIMESTAMP', 'TIMESTAMPTZ',
  'UUID',
  'JSONB', 'JSON',
  'ARRAY', 'ENUM'
];

const REFERENTIAL_ACTIONS = ['CASCADE', 'SET NULL', 'RESTRICT', 'NO ACTION'] as const;

export function SchemaEditorPanel({
  schema,
  onSchemaChange,
  selectedTable,
  selectedRelationship,
  validationResult,
  readOnly = false
}: SchemaEditorPanelProps) {
  const [activeTab, setActiveTab] = useState<'schema' | 'table' | 'relationship' | 'validation'>('schema');
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['general']));

  // Auto-select tab based on selection
  React.useEffect(() => {
    if (selectedTable) {
      setActiveTab('table');
    } else if (selectedRelationship) {
      setActiveTab('relationship');
    } else if (validationResult && !validationResult.isValid) {
      setActiveTab('validation');
    }
  }, [selectedTable, selectedRelationship, validationResult]);

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  const updateSchema = (updates: Partial<DatabaseSchema>) => {
    if (readOnly) return;
    onSchemaChange({
      ...schema,
      ...updates,
      updatedAt: new Date()
    });
  };

  const updateTable = (tableId: string, updates: Partial<Table>) => {
    if (readOnly) return;
    const updatedTables = schema.tables.map(table =>
      table.id === tableId ? { ...table, ...updates } : table
    );
    updateSchema({ tables: updatedTables });
  };

  const updateColumn = (tableId: string, columnId: string, updates: Partial<Column>) => {
    if (readOnly) return;
    const updatedTables = schema.tables.map(table => {
      if (table.id === tableId) {
        const updatedColumns = table.columns.map(col =>
          col.id === columnId ? { ...col, ...updates } : col
        );
        return { ...table, columns: updatedColumns };
      }
      return table;
    });
    updateSchema({ tables: updatedTables });
  };

  const addColumn = (tableId: string) => {
    if (readOnly) return;
    const newColumn: Column = {
      id: `col_${Date.now()}`,
      name: 'new_column',
      type: 'VARCHAR',
      length: 255,
      nullable: true,
      constraints: [],
    };
    
    const table = schema.tables.find(t => t.id === tableId);
    if (table) {
      updateTable(tableId, { 
        columns: [...table.columns, newColumn] 
      });
    }
  };

  const deleteColumn = (tableId: string, columnId: string) => {
    if (readOnly) return;
    const table = schema.tables.find(t => t.id === tableId);
    if (table) {
      updateTable(tableId, { 
        columns: table.columns.filter(col => col.id !== columnId) 
      });
    }
  };

  const updateRelationship = (relationshipId: string, updates: Partial<Relationship>) => {
    if (readOnly) return;
    const updatedRelationships = schema.relationships.map(rel =>
      rel.id === relationshipId ? { ...rel, ...updates } : rel
    );
    updateSchema({ relationships: updatedRelationships });
  };

  const addTable = () => {
    if (readOnly) return;
    const newTable: Table = {
      id: `table_${Date.now()}`,
      name: 'new_table',
      columns: [{
        id: `col_${Date.now()}`,
        name: 'id',
        type: 'UUID',
        nullable: false,
        defaultValue: 'gen_random_uuid()',
        constraints: [{ type: 'PRIMARY KEY' }]
      }],
      indexes: [],
      position: { x: 0, y: 0 }
    };
    
    updateSchema({ 
      tables: [...schema.tables, newTable] 
    });
  };

  const renderSchemaTab = () => (
    <div className="space-y-4">
      <Collapsible 
        open={expandedSections.has('general')}
        onOpenChange={() => toggleSection('general')}
      >
        <CollapsibleTrigger className="flex items-center justify-between w-full p-2 hover:bg-gray-50 rounded">
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4" />
            <span className="font-medium">General</span>
          </div>
          {expandedSections.has('general') ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </CollapsibleTrigger>
        <CollapsibleContent className="px-2 pb-2 space-y-3">
          <div>
            <Label htmlFor="schema-name">Schema Name</Label>
            <Input
              id="schema-name"
              value={schema.name}
              onChange={(e) => updateSchema({ name: e.target.value })}
              disabled={readOnly}
            />
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium">Tables:</span>
              <span className="ml-2">{schema.tables.length}</span>
            </div>
            <div>
              <span className="font-medium">Relationships:</span>
              <span className="ml-2">{schema.relationships.length}</span>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      <Collapsible 
        open={expandedSections.has('tables')}
        onOpenChange={() => toggleSection('tables')}
      >
        <CollapsibleTrigger className="flex items-center justify-between w-full p-2 hover:bg-gray-50 rounded">
          <div className="flex items-center gap-2">
            <TableIcon className="h-4 w-4" />
            <span className="font-medium">Tables</span>
          </div>
          {expandedSections.has('tables') ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </CollapsibleTrigger>
        <CollapsibleContent className="px-2 pb-2 space-y-2">
          {schema.tables.map(table => (
            <div
              key={table.id}
              className={cn(
                "p-2 rounded border cursor-pointer transition-colors",
                selectedTable?.id === table.id ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:bg-gray-50"
              )}
              onClick={() => setActiveTab('table')}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm">{table.name}</span>
                <Badge variant="outline" className="text-xs">
                  {table.columns.length} cols
                </Badge>
              </div>
            </div>
          ))}
          {!readOnly && (
            <Button
              variant="outline"
              size="sm"
              onClick={addTable}
              className="w-full"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Table
            </Button>
          )}
        </CollapsibleContent>
      </Collapsible>

      <Collapsible 
        open={expandedSections.has('relationships')}
        onOpenChange={() => toggleSection('relationships')}
      >
        <CollapsibleTrigger className="flex items-center justify-between w-full p-2 hover:bg-gray-50 rounded">
          <div className="flex items-center gap-2">
            <Link className="h-4 w-4" />
            <span className="font-medium">Relationships</span>
          </div>
          {expandedSections.has('relationships') ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </CollapsibleTrigger>
        <CollapsibleContent className="px-2 pb-2 space-y-2">
          {schema.relationships.map(relationship => (
            <div
              key={relationship.id}
              className={cn(
                "p-2 rounded border cursor-pointer transition-colors",
                selectedRelationship?.id === relationship.id ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:bg-gray-50"
              )}
              onClick={() => setActiveTab('relationship')}
            >
              <div className="text-xs">
                <span className="font-medium">{relationship.sourceTable}</span>
                <span className="text-gray-500 mx-1">→</span>
                <span className="font-medium">{relationship.targetTable}</span>
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {relationship.sourceColumn} → {relationship.targetColumn}
              </div>
            </div>
          ))}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );

  const renderTableTab = () => {
    if (!selectedTable) {
      return (
        <div className="flex items-center justify-center h-32 text-gray-500">
          <div className="text-center">
            <TableIcon className="h-8 w-8 mx-auto mb-2" />
            <p>Select a table to edit its properties</p>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div>
          <Label htmlFor="table-name">Table Name</Label>
          <Input
            id="table-name"
            value={selectedTable.name}
            onChange={(e) => updateTable(selectedTable.id, { name: e.target.value })}
            disabled={readOnly}
          />
        </div>

        <div>
          <Label htmlFor="table-comment">Comment</Label>
          <Input
            id="table-comment"
            value={selectedTable.comment || ''}
            onChange={(e) => updateTable(selectedTable.id, { comment: e.target.value })}
            disabled={readOnly}
            placeholder="Optional table description"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <Label>Columns</Label>
            {!readOnly && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => addColumn(selectedTable.id)}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add
              </Button>
            )}
          </div>
          
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {selectedTable.columns.map(column => (
              <Card key={column.id} className="p-3">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Input
                      value={column.name}
                      onChange={(e) => updateColumn(selectedTable.id, column.id, { name: e.target.value })}
                      disabled={readOnly}
                      className="font-medium"
                    />
                    {!readOnly && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteColumn(selectedTable.id, column.id)}
                        className="text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Type</Label>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm" className="w-full justify-between">
                            {column.type}
                            <ChevronDown className="h-3 w-3" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          {POSTGRES_TYPES.map(type => (
                            <DropdownMenuItem
                              key={type}
                              onClick={() => updateColumn(selectedTable.id, column.id, { type })}
                            >
                              {type}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    
                    {(column.type === 'VARCHAR' || column.type === 'CHAR') && (
                      <div>
                        <Label className="text-xs">Length</Label>
                        <Input
                          type="number"
                          value={column.length || ''}
                          onChange={(e) => {
                            const value = parseInt(e.target.value);
                            updateColumn(selectedTable.id, column.id, isNaN(value) ? {} : { length: value });
                          }}
                          disabled={readOnly}
                          className="text-xs"
                        />
                      </div>
                    )}
                  </div>

                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id={`nullable-${column.id}`}
                        checked={!column.nullable}
                        onCheckedChange={(checked) => updateColumn(selectedTable.id, column.id, { nullable: !checked })}
                        disabled={readOnly}
                      />
                      <Label htmlFor={`nullable-${column.id}`} className="text-xs">NOT NULL</Label>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1">
                    {column.constraints.map((constraint, index) => (
                      <Badge key={index} variant="outline" className="text-xs">
                        {constraint.type}
                      </Badge>
                    ))}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderRelationshipTab = () => {
    if (!selectedRelationship) {
      return (
        <div className="flex items-center justify-center h-32 text-gray-500">
          <div className="text-center">
            <Link className="h-8 w-8 mx-auto mb-2" />
            <p>Select a relationship to edit its properties</p>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div>
          <Label htmlFor="relationship-name">Relationship Name</Label>
          <Input
            id="relationship-name"
            value={selectedRelationship.name || ''}
            onChange={(e) => updateRelationship(selectedRelationship.id, { name: e.target.value })}
            disabled={readOnly}
            placeholder="Optional relationship name"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Source</Label>
            <div className="text-sm bg-gray-50 p-2 rounded">
              <div className="font-medium">{selectedRelationship.sourceTable}</div>
              <div className="text-gray-600">{selectedRelationship.sourceColumn}</div>
            </div>
          </div>
          <div>
            <Label>Target</Label>
            <div className="text-sm bg-gray-50 p-2 rounded">
              <div className="font-medium">{selectedRelationship.targetTable}</div>
              <div className="text-gray-600">{selectedRelationship.targetColumn}</div>
            </div>
          </div>
        </div>

        <div>
          <Label>Relationship Type</Label>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="w-full justify-between">
                {selectedRelationship.type}
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => updateRelationship(selectedRelationship.id, { type: 'one-to-one' })}>
                One-to-One
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => updateRelationship(selectedRelationship.id, { type: 'one-to-many' })}>
                One-to-Many
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => updateRelationship(selectedRelationship.id, { type: 'many-to-many' })}>
                Many-to-Many
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>On Delete</Label>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="w-full justify-between">
                  {selectedRelationship.onDelete || 'CASCADE'}
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {REFERENTIAL_ACTIONS.map(action => (
                  <DropdownMenuItem 
                    key={action}
                    onClick={() => updateRelationship(selectedRelationship.id, { onDelete: action })}
                  >
                    {action}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div>
            <Label>On Update</Label>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="w-full justify-between">
                  {selectedRelationship.onUpdate || 'CASCADE'}
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {REFERENTIAL_ACTIONS.map(action => (
                  <DropdownMenuItem 
                    key={action}
                    onClick={() => updateRelationship(selectedRelationship.id, { onUpdate: action })}
                  >
                    {action}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    );
  };

  const renderValidationTab = () => {
    if (!validationResult) {
      return (
        <div className="flex items-center justify-center h-32 text-gray-500">
          <div className="text-center">
            <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />
            <p>No validation results available</p>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          {validationResult.isValid ? (
            <CheckCircle className="h-5 w-5 text-green-500" />
          ) : (
            <AlertTriangle className="h-5 w-5 text-red-500" />
          )}
          <span className="font-medium">
            {validationResult.isValid ? 'Schema is valid' : 'Schema has issues'}
          </span>
        </div>

        {validationResult.errors.length > 0 && (
          <div>
            <h4 className="font-medium text-red-600 mb-2">Errors ({validationResult.errors.length})</h4>
            <div className="space-y-2">
              {validationResult.errors.map(error => (
                <Card key={error.id} className="border-red-200 bg-red-50">
                  <CardContent className="p-3">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-red-900">{error.message}</p>
                        {error.suggestion && (
                          <p className="text-xs text-red-700 mt-1">{error.suggestion}</p>
                        )}
                        {(error.table || error.column) && (
                          <div className="flex gap-2 mt-1">
                            {error.table && (
                              <Badge variant="outline" className="text-xs bg-red-100">
                                {error.table}
                              </Badge>
                            )}
                            {error.column && (
                              <Badge variant="outline" className="text-xs bg-red-100">
                                {error.column}
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {validationResult.warnings.length > 0 && (
          <div>
            <h4 className="font-medium text-yellow-600 mb-2">Warnings ({validationResult.warnings.length})</h4>
            <div className="space-y-2">
              {validationResult.warnings.map(warning => (
                <Card key={warning.id} className="border-yellow-200 bg-yellow-50">
                  <CardContent className="p-3">
                    <div className="flex items-start gap-2">
                      <Info className="h-4 w-4 text-yellow-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-yellow-900">{warning.message}</p>
                        {warning.suggestion && (
                          <p className="text-xs text-yellow-700 mt-1">{warning.suggestion}</p>
                        )}
                        {(warning.table || warning.column) && (
                          <div className="flex gap-2 mt-1">
                            {warning.table && (
                              <Badge variant="outline" className="text-xs bg-yellow-100">
                                {warning.table}
                              </Badge>
                            )}
                            {warning.column && (
                              <Badge variant="outline" className="text-xs bg-yellow-100">
                                {warning.column}
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Schema Editor</CardTitle>
        
        {/* Tab Navigation */}
        <div className="grid grid-cols-4 gap-1 p-1 bg-gray-100 rounded-lg">
          {(['schema', 'table', 'relationship', 'validation'] as const).map(tab => (
            <Button
              key={tab}
              variant={activeTab === tab ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab(tab)}
              className="capitalize text-xs"
            >
              {tab === 'schema' && <Database className="h-3 w-3 mr-1" />}
              {tab === 'table' && <TableIcon className="h-3 w-3 mr-1" />}
              {tab === 'relationship' && <Link className="h-3 w-3 mr-1" />}
              {tab === 'validation' && (
                validationResult?.isValid ? 
                  <CheckCircle className="h-3 w-3 mr-1 text-green-500" /> : 
                  <AlertTriangle className="h-3 w-3 mr-1 text-red-500" />
              )}
              {tab}
            </Button>
          ))}
        </div>
      </CardHeader>

      <CardContent className="flex-1 overflow-y-auto">
        {activeTab === 'schema' && renderSchemaTab()}
        {activeTab === 'table' && renderTableTab()}
        {activeTab === 'relationship' && renderRelationshipTab()}
        {activeTab === 'validation' && renderValidationTab()}
      </CardContent>
    </div>
  );
}