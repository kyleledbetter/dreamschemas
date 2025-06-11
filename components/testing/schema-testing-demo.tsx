'use client';

import React, { useState } from 'react';
import { SchemaTestingInterface } from './schema-testing-interface';
import { generateId } from '@/lib/utils/index';
import type { DatabaseSchema, Table, Relationship } from '@/types/schema.types';
import type { CSVParseResult } from '@/types/csv.types';

/**
 * Demo component showing PGLite testing integration
 * This demonstrates how to use the SchemaTestingInterface with sample data
 */
export function SchemaTestingDemo() {
  // Sample schema for demo purposes
  const [schema] = useState<DatabaseSchema>(() => ({
    id: generateId(),
    name: 'Blog Database',
    version: '1.0.0',
    createdAt: new Date(),
    updatedAt: new Date(),
    tables: [
      {
        id: 'users-table',
        name: 'users',
        comment: 'User accounts table',
        position: { x: 100, y: 100 },
        columns: [
          {
            id: 'users-id',
            name: 'id',
            type: 'UUID',
            nullable: false,
            defaultValue: 'gen_random_uuid()',
            constraints: [{ type: 'PRIMARY KEY' }],
            comment: 'Primary key'
          },
          {
            id: 'users-email',
            name: 'email',
            type: 'VARCHAR',
            length: 255,
            nullable: false,
            constraints: [
              { type: 'UNIQUE' },
              { type: 'CHECK', value: "email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$'" }
            ],
            comment: 'User email address'
          },
          {
            id: 'users-username',
            name: 'username',
            type: 'VARCHAR',
            length: 50,
            nullable: false,
            constraints: [{ type: 'UNIQUE' }],
            comment: 'Unique username'
          },
          {
            id: 'users-created-at',
            name: 'created_at',
            type: 'TIMESTAMPTZ',
            nullable: false,
            defaultValue: 'NOW()',
            constraints: [{ type: 'NOT NULL' }]
          },
          {
            id: 'users-updated-at',
            name: 'updated_at',
            type: 'TIMESTAMPTZ',
            nullable: false,
            defaultValue: 'NOW()',
            constraints: [{ type: 'NOT NULL' }]
          }
        ],
        indexes: [
          {
            id: 'idx-users-email',
            name: 'idx_users_email',
            columns: ['email'],
            unique: true
          },
          {
            id: 'idx-users-username',
            name: 'idx_users_username', 
            columns: ['username'],
            unique: true
          }
        ]
      },
      {
        id: 'posts-table',
        name: 'posts',
        comment: 'Blog posts table',
        position: { x: 400, y: 100 },
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
            id: 'posts-user-id',
            name: 'user_id',
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
            id: 'posts-title',
            name: 'title',
            type: 'VARCHAR',
            length: 200,
            nullable: false,
            constraints: [{ type: 'NOT NULL' }]
          },
          {
            id: 'posts-content',
            name: 'content',
            type: 'TEXT',
            nullable: true
          },
          {
            id: 'posts-published',
            name: 'published',
            type: 'BOOLEAN',
            nullable: false,
            defaultValue: 'FALSE'
          },
          {
            id: 'posts-created-at',
            name: 'created_at',
            type: 'TIMESTAMPTZ',
            nullable: false,
            defaultValue: 'NOW()'
          },
          {
            id: 'posts-updated-at',
            name: 'updated_at',
            type: 'TIMESTAMPTZ',
            nullable: false,
            defaultValue: 'NOW()'
          }
        ],
        indexes: [
          {
            id: 'idx-posts-user-id',
            name: 'idx_posts_user_id',
            columns: ['user_id'],
            unique: false
          },
          {
            id: 'idx-posts-published',
            name: 'idx_posts_published',
            columns: ['published'],
            unique: false
          }
        ]
      }
    ] as Table[],
    relationships: [
      {
        id: 'rel-posts-users',
        name: 'posts_user_id_fkey',
        sourceTable: 'posts',
        sourceColumn: 'user_id',
        targetTable: 'users',
        targetColumn: 'id',
        type: 'one-to-many',
        onDelete: 'CASCADE'
      }
    ] as Relationship[],
    rlsPolicies: [
      {
        id: 'rls-users-own-data',
        tableName: 'users',
        name: 'users_own_data',
        command: 'ALL',
        using: 'auth.uid() = id',
        roles: ['authenticated']
      },
      {
        id: 'rls-posts-own-data',
        tableName: 'posts',
        name: 'posts_own_data',
        command: 'ALL',
        using: 'auth.uid() = user_id',
        roles: ['authenticated']
      }
    ]
  }));

  // Sample CSV data for demo
  const [csvData] = useState<CSVParseResult[]>(() => [
    {
      id: 'users-csv',
      fileName: 'users.csv',
      headers: ['id', 'email', 'username', 'created_at', 'updated_at'],
      data: [
        ['550e8400-e29b-41d4-a716-446655440000', 'john@example.com', 'johndoe', '2024-01-01 10:00:00', '2024-01-01 10:00:00'],
        ['550e8400-e29b-41d4-a716-446655440001', 'jane@example.com', 'janedoe', '2024-01-02 11:00:00', '2024-01-02 11:00:00'],
        ['550e8400-e29b-41d4-a716-446655440002', 'bob@example.com', 'bobsmith', '2024-01-03 12:00:00', '2024-01-03 12:00:00']
      ],
      totalRows: 3,
      sampledRows: 3,
      columns: [
        {
          index: 0,
          name: 'id',
          originalName: 'id',
          sampleValues: ['550e8400-e29b-41d4-a716-446655440000', '550e8400-e29b-41d4-a716-446655440001'],
          uniqueValues: new Set(['550e8400-e29b-41d4-a716-446655440000', '550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440002']),
          nullCount: 0,
          emptyCount: 0,
          totalCount: 3
        },
        {
          index: 1,
          name: 'email',
          originalName: 'email',
          sampleValues: ['john@example.com', 'jane@example.com'],
          uniqueValues: new Set(['john@example.com', 'jane@example.com', 'bob@example.com']),
          nullCount: 0,
          emptyCount: 0,
          totalCount: 3
        },
        {
          index: 2,
          name: 'username',
          originalName: 'username',
          sampleValues: ['johndoe', 'janedoe'],
          uniqueValues: new Set(['johndoe', 'janedoe', 'bobsmith']),
          nullCount: 0,
          emptyCount: 0,
          totalCount: 3
        },
        {
          index: 3,
          name: 'created_at',
          originalName: 'created_at',
          sampleValues: ['2024-01-01 10:00:00', '2024-01-02 11:00:00'],
          uniqueValues: new Set(['2024-01-01 10:00:00', '2024-01-02 11:00:00', '2024-01-03 12:00:00']),
          nullCount: 0,
          emptyCount: 0,
          totalCount: 3
        },
        {
          index: 4,
          name: 'updated_at',
          originalName: 'updated_at',
          sampleValues: ['2024-01-01 10:00:00', '2024-01-02 11:00:00'],
          uniqueValues: new Set(['2024-01-01 10:00:00', '2024-01-02 11:00:00', '2024-01-03 12:00:00']),
          nullCount: 0,
          emptyCount: 0,
          totalCount: 3
        }
      ],
      config: {
        delimiter: ',',
        hasHeader: true,
        skipEmptyLines: true,
        trimWhitespace: true,
        sampleSize: 1000
      },
      parseErrors: [],
      timestamp: new Date()
    },
    {
      id: 'posts-csv',
      fileName: 'posts.csv',
      headers: ['id', 'user_id', 'title', 'content', 'published', 'created_at', 'updated_at'],
      data: [
        ['660e8400-e29b-41d4-a716-446655440000', '550e8400-e29b-41d4-a716-446655440000', 'First Post', 'This is my first blog post', 'true', '2024-01-01 15:00:00', '2024-01-01 15:00:00'],
        ['660e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440001', 'Hello World', 'Welcome to my blog!', 'true', '2024-01-02 16:00:00', '2024-01-02 16:00:00']
      ],
      totalRows: 2,
      sampledRows: 2,
      columns: [
        {
          index: 0,
          name: 'id',
          originalName: 'id',
          sampleValues: ['660e8400-e29b-41d4-a716-446655440000', '660e8400-e29b-41d4-a716-446655440001'],
          uniqueValues: new Set(['660e8400-e29b-41d4-a716-446655440000', '660e8400-e29b-41d4-a716-446655440001']),
          nullCount: 0,
          emptyCount: 0,
          totalCount: 2
        },
        {
          index: 1,
          name: 'user_id',
          originalName: 'user_id',
          sampleValues: ['550e8400-e29b-41d4-a716-446655440000', '550e8400-e29b-41d4-a716-446655440001'],
          uniqueValues: new Set(['550e8400-e29b-41d4-a716-446655440000', '550e8400-e29b-41d4-a716-446655440001']),
          nullCount: 0,
          emptyCount: 0,
          totalCount: 2
        },
        {
          index: 2,
          name: 'title',
          originalName: 'title',
          sampleValues: ['First Post', 'Hello World'],
          uniqueValues: new Set(['First Post', 'Hello World']),
          nullCount: 0,
          emptyCount: 0,
          totalCount: 2
        },
        {
          index: 3,
          name: 'content',
          originalName: 'content',
          sampleValues: ['This is my first blog post', 'Welcome to my blog!'],
          uniqueValues: new Set(['This is my first blog post', 'Welcome to my blog!']),
          nullCount: 0,
          emptyCount: 0,
          totalCount: 2
        },
        {
          index: 4,
          name: 'published',
          originalName: 'published',
          sampleValues: ['true', 'true'],
          uniqueValues: new Set(['true']),
          nullCount: 0,
          emptyCount: 0,
          totalCount: 2
        },
        {
          index: 5,
          name: 'created_at',
          originalName: 'created_at',
          sampleValues: ['2024-01-01 15:00:00', '2024-01-02 16:00:00'],
          uniqueValues: new Set(['2024-01-01 15:00:00', '2024-01-02 16:00:00']),
          nullCount: 0,
          emptyCount: 0,
          totalCount: 2
        },
        {
          index: 6,
          name: 'updated_at',
          originalName: 'updated_at',
          sampleValues: ['2024-01-01 15:00:00', '2024-01-02 16:00:00'],
          uniqueValues: new Set(['2024-01-01 15:00:00', '2024-01-02 16:00:00']),
          nullCount: 0,
          emptyCount: 0,
          totalCount: 2
        }
      ],
      config: {
        delimiter: ',',
        hasHeader: true,
        skipEmptyLines: true,
        trimWhitespace: true,
        sampleSize: 1000
      },
      parseErrors: [],
      timestamp: new Date()
    }
  ]);

  const handleSchemaUpdate = (updatedSchema: DatabaseSchema) => {
    console.log('Schema updated:', updatedSchema);
    // In a real application, this would update the parent component's schema state
  };

  return (
    <div className="h-screen">
      <SchemaTestingInterface
        schema={schema}
        csvData={csvData}
        onSchemaUpdate={handleSchemaUpdate}
      />
    </div>
  );
}