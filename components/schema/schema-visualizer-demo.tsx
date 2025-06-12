"use client"

import React, { useState } from 'react';
import { SchemaVisualizer } from './schema-visualizer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DatabaseSchema, Table, Relationship } from '@/types/schema.types';

/**
 * Demo component showcasing the Schema Visualizer with sample data
 * This demonstrates how to integrate the visualizer into your application
 */
export function SchemaVisualizerDemo() {
  // Sample schema data for demonstration
  const [schema, setSchema] = useState<DatabaseSchema>(() => {
    const sampleTables: Table[] = [
      {
        id: 'users-table',
        name: 'users',
        columns: [
          {
            id: 'users-id',
            name: 'id',
            type: 'UUID',
            nullable: false,
            defaultValue: 'gen_random_uuid()',
            constraints: [{ type: 'PRIMARY KEY' }]
          },
          {
            id: 'users-email',
            name: 'email',
            type: 'VARCHAR',
            length: 255,
            nullable: false,
            constraints: [{ type: 'UNIQUE' }]
          },
          {
            id: 'users-name',
            name: 'full_name',
            type: 'VARCHAR',
            length: 100,
            nullable: false,
            constraints: []
          },
          {
            id: 'users-created',
            name: 'created_at',
            type: 'TIMESTAMPTZ',
            nullable: false,
            defaultValue: 'NOW()',
            constraints: []
          }
        ],
        indexes: [],
        position: { x: 100, y: 100 }
      },
      {
        id: 'posts-table',
        name: 'posts',
        columns: [
          {
            id: 'posts-id',
            name: 'id',
            type: 'UUID',
            nullable: false,
            defaultValue: 'gen_random_uuid()',
            constraints: [{ type: 'PRIMARY KEY' }]
          },
          {
            id: 'posts-title',
            name: 'title',
            type: 'VARCHAR',
            length: 200,
            nullable: false,
            constraints: []
          },
          {
            id: 'posts-content',
            name: 'content',
            type: 'TEXT',
            nullable: true,
            constraints: []
          },
          {
            id: 'posts-author-id',
            name: 'author_id',
            type: 'UUID',
            nullable: false,
            constraints: [
              {
                type: 'FOREIGN KEY',
                referencedTable: 'users',
                referencedColumn: 'id',
                onDelete: 'CASCADE'
              }
            ]
          },
          {
            id: 'posts-published',
            name: 'published_at',
            type: 'TIMESTAMPTZ',
            nullable: true,
            constraints: []
          }
        ],
        indexes: [],
        position: { x: 500, y: 100 }
      },
      {
        id: 'comments-table',
        name: 'comments',
        columns: [
          {
            id: 'comments-id',
            name: 'id',
            type: 'UUID',
            nullable: false,
            defaultValue: 'gen_random_uuid()',
            constraints: [{ type: 'PRIMARY KEY' }]
          },
          {
            id: 'comments-content',
            name: 'content',
            type: 'TEXT',
            nullable: false,
            constraints: []
          },
          {
            id: 'comments-post-id',
            name: 'post_id',
            type: 'UUID',
            nullable: false,
            constraints: [
              {
                type: 'FOREIGN KEY',
                referencedTable: 'posts',
                referencedColumn: 'id',
                onDelete: 'CASCADE'
              }
            ]
          },
          {
            id: 'comments-author-id',
            name: 'author_id',
            type: 'UUID',
            nullable: false,
            constraints: [
              {
                type: 'FOREIGN KEY',
                referencedTable: 'users',
                referencedColumn: 'id',
                onDelete: 'CASCADE'
              }
            ]
          },
          {
            id: 'comments-created',
            name: 'created_at',
            type: 'TIMESTAMPTZ',
            nullable: false,
            defaultValue: 'NOW()',
            constraints: []
          }
        ],
        indexes: [],
        position: { x: 300, y: 400 }
      }
    ];

    const sampleRelationships: Relationship[] = [
      {
        id: 'users-posts',
        sourceTable: 'users',
        sourceColumn: 'id',
        targetTable: 'posts',
        targetColumn: 'author_id',
        type: 'one-to-many',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      },
      {
        id: 'posts-comments',
        sourceTable: 'posts',
        sourceColumn: 'id',
        targetTable: 'comments',
        targetColumn: 'post_id',
        type: 'one-to-many',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      },
      {
        id: 'users-comments',
        sourceTable: 'users',
        sourceColumn: 'id',
        targetTable: 'comments',
        targetColumn: 'author_id',
        type: 'one-to-many',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      }
    ];

    return {
      id: 'demo-schema',
      name: 'Blog Platform Schema',
      tables: sampleTables,
      relationships: sampleRelationships,
      rlsPolicies: [],
      version: '1.0.0',
      createdAt: new Date(),
      updatedAt: new Date()
    };
  });

  const [readOnly, setReadOnly] = useState(false);

  const handleSchemaChange = (updatedSchema: DatabaseSchema) => {
    setSchema(updatedSchema);
    console.log('Schema updated:', updatedSchema);
  };

  const resetSchema = () => {
    setSchema(prevSchema => ({
      ...prevSchema,
      updatedAt: new Date()
    }));
  };

  return (
    <div className="h-screen flex flex-col">
      {/* Demo Controls */}
      <Card className="mb-4 mx-4 mt-4">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Schema Visualizer Demo</CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="outline">
                Tables: {schema.tables.length}
              </Badge>
              <Badge variant="outline">
                Relationships: {schema.relationships.length}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex gap-2">
            <Button
              variant={readOnly ? "outline" : "default"}
              onClick={() => setReadOnly(!readOnly)}
              size="sm"
            >
              {readOnly ? "Enable Editing" : "Read Only Mode"}
            </Button>
            <Button
              variant="outline"
              onClick={resetSchema}
              size="sm"
            >
              Refresh
            </Button>
          </div>
          <p className="text-sm text-gray-600 mt-2">
            This demo showcases the React Flow-based schema visualizer. 
            Try dragging tables, selecting elements, and using the sidebar editor.
            {readOnly && " (Currently in read-only mode)"}
          </p>
        </CardContent>
      </Card>

      {/* Schema Visualizer */}
      <div className="flex-1 mx-4 mb-4">
        <SchemaVisualizer
          schema={schema}
          onSchemaChange={handleSchemaChange}
          readOnly={readOnly}
          className="border rounded-lg"
        />
      </div>
    </div>
  );
}

export default SchemaVisualizerDemo;