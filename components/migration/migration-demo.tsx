'use client';

import React, { useState } from 'react';
import { MigrationPreview } from './migration-preview';
import { generateId } from '@/lib/utils/index';
import type { DatabaseSchema, Table, Relationship } from '@/types/schema.types';

/**
 * Demo component showing Migration Generation & Export functionality
 * This demonstrates how to use the MigrationPreview with sample data
 */
export function MigrationDemo() {
  // Sample schema for demo purposes (same as testing demo for consistency)
  const [schema] = useState<DatabaseSchema>(() => ({
    id: generateId(),
    name: 'E-commerce Platform',
    version: '1.0.0',
    createdAt: new Date(),
    updatedAt: new Date(),
    tables: [
      {
        id: 'users-table',
        name: 'users',
        comment: 'User accounts and authentication',
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
              { type: 'CHECK', value: "email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\\\.[A-Za-z]{2,}$'" }
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
            id: 'users-first-name',
            name: 'first_name',
            type: 'VARCHAR',
            length: 100,
            nullable: false,
            comment: 'User first name'
          },
          {
            id: 'users-last-name',
            name: 'last_name',
            type: 'VARCHAR',
            length: 100,
            nullable: false,
            comment: 'User last name'
          },
          {
            id: 'users-avatar-url',
            name: 'avatar_url',
            type: 'TEXT',
            nullable: true,
            comment: 'Profile picture URL'
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
          },
          {
            id: 'idx-users-name',
            name: 'idx_users_name',
            columns: ['first_name', 'last_name'],
            unique: false
          }
        ]
      },
      {
        id: 'products-table',
        name: 'products',
        comment: 'Product catalog',
        position: { x: 400, y: 100 },
        columns: [
          {
            id: 'products-id',
            name: 'id',
            type: 'UUID',
            nullable: false,
            defaultValue: 'gen_random_uuid()',
            constraints: [{ type: 'PRIMARY KEY' }]
          },
          {
            id: 'products-name',
            name: 'name',
            type: 'VARCHAR',
            length: 200,
            nullable: false,
            constraints: [{ type: 'NOT NULL' }],
            comment: 'Product name'
          },
          {
            id: 'products-description',
            name: 'description',
            type: 'TEXT',
            nullable: true,
            comment: 'Product description'
          },
          {
            id: 'products-price',
            name: 'price',
            type: 'NUMERIC',
            precision: 10,
            scale: 2,
            nullable: false,
            constraints: [
              { type: 'CHECK', value: 'price >= 0' }
            ],
            comment: 'Product price in cents'
          },
          {
            id: 'products-stock-quantity',
            name: 'stock_quantity',
            type: 'INTEGER',
            nullable: false,
            defaultValue: '0',
            constraints: [
              { type: 'CHECK', value: 'stock_quantity >= 0' }
            ],
            comment: 'Available stock'
          },
          {
            id: 'products-category',
            name: 'category',
            type: 'VARCHAR',
            length: 100,
            nullable: false,
            comment: 'Product category'
          },
          {
            id: 'products-is-active',
            name: 'is_active',
            type: 'BOOLEAN',
            nullable: false,
            defaultValue: 'TRUE',
            comment: 'Whether product is active'
          },
          {
            id: 'products-created-at',
            name: 'created_at',
            type: 'TIMESTAMPTZ',
            nullable: false,
            defaultValue: 'NOW()'
          },
          {
            id: 'products-updated-at',
            name: 'updated_at',
            type: 'TIMESTAMPTZ',
            nullable: false,
            defaultValue: 'NOW()'
          }
        ],
        indexes: [
          {
            id: 'idx-products-category',
            name: 'idx_products_category',
            columns: ['category'],
            unique: false
          },
          {
            id: 'idx-products-active',
            name: 'idx_products_active',
            columns: ['is_active'],
            unique: false
          },
          {
            id: 'idx-products-price',
            name: 'idx_products_price',
            columns: ['price'],
            unique: false
          }
        ]
      },
      {
        id: 'orders-table',
        name: 'orders',
        comment: 'Customer orders',
        position: { x: 700, y: 100 },
        columns: [
          {
            id: 'orders-id',
            name: 'id',
            type: 'UUID',
            nullable: false,
            defaultValue: 'gen_random_uuid()',
            constraints: [{ type: 'PRIMARY KEY' }]
          },
          {
            id: 'orders-user-id',
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
            id: 'orders-status',
            name: 'status',
            type: 'VARCHAR',
            length: 50,
            nullable: false,
            defaultValue: "'pending'",
            constraints: [
              { type: 'CHECK', value: "status IN ('pending', 'processing', 'shipped', 'delivered', 'cancelled')" }
            ],
            comment: 'Order status'
          },
          {
            id: 'orders-total-amount',
            name: 'total_amount',
            type: 'NUMERIC',
            precision: 10,
            scale: 2,
            nullable: false,
            constraints: [
              { type: 'CHECK', value: 'total_amount >= 0' }
            ],
            comment: 'Total order amount'
          },
          {
            id: 'orders-shipping-address',
            name: 'shipping_address',
            type: 'JSONB',
            nullable: false,
            comment: 'Shipping address details'
          },
          {
            id: 'orders-created-at',
            name: 'created_at',
            type: 'TIMESTAMPTZ',
            nullable: false,
            defaultValue: 'NOW()'
          },
          {
            id: 'orders-updated-at',
            name: 'updated_at',
            type: 'TIMESTAMPTZ',
            nullable: false,
            defaultValue: 'NOW()'
          }
        ],
        indexes: [
          {
            id: 'idx-orders-user-id',
            name: 'idx_orders_user_id',
            columns: ['user_id'],
            unique: false
          },
          {
            id: 'idx-orders-status',
            name: 'idx_orders_status',
            columns: ['status'],
            unique: false
          },
          {
            id: 'idx-orders-created-at',
            name: 'idx_orders_created_at',
            columns: ['created_at'],
            unique: false
          }
        ]
      },
      {
        id: 'order-items-table',
        name: 'order_items',
        comment: 'Items within orders',
        position: { x: 1000, y: 100 },
        columns: [
          {
            id: 'order-items-id',
            name: 'id',
            type: 'UUID',
            nullable: false,
            defaultValue: 'gen_random_uuid()',
            constraints: [{ type: 'PRIMARY KEY' }]
          },
          {
            id: 'order-items-order-id',
            name: 'order_id',
            type: 'UUID',
            nullable: false,
            constraints: [
              { 
                type: 'FOREIGN KEY',
                referencedTable: 'orders',
                referencedColumn: 'id',
                onDelete: 'CASCADE'
              }
            ]
          },
          {
            id: 'order-items-product-id',
            name: 'product_id',
            type: 'UUID',
            nullable: false,
            constraints: [
              { 
                type: 'FOREIGN KEY',
                referencedTable: 'products',
                referencedColumn: 'id',
                onDelete: 'RESTRICT'
              }
            ]
          },
          {
            id: 'order-items-quantity',
            name: 'quantity',
            type: 'INTEGER',
            nullable: false,
            constraints: [
              { type: 'CHECK', value: 'quantity > 0' }
            ],
            comment: 'Quantity ordered'
          },
          {
            id: 'order-items-unit-price',
            name: 'unit_price',
            type: 'NUMERIC',
            precision: 10,
            scale: 2,
            nullable: false,
            constraints: [
              { type: 'CHECK', value: 'unit_price >= 0' }
            ],
            comment: 'Price per unit at time of order'
          },
          {
            id: 'order-items-created-at',
            name: 'created_at',
            type: 'TIMESTAMPTZ',
            nullable: false,
            defaultValue: 'NOW()'
          }
        ],
        indexes: [
          {
            id: 'idx-order-items-order-id',
            name: 'idx_order_items_order_id',
            columns: ['order_id'],
            unique: false
          },
          {
            id: 'idx-order-items-product-id',
            name: 'idx_order_items_product_id',
            columns: ['product_id'],
            unique: false
          }
        ]
      }
    ] as Table[],
    relationships: [
      {
        id: 'rel-orders-users',
        name: 'orders_user_id_fkey',
        sourceTable: 'orders',
        sourceColumn: 'user_id',
        targetTable: 'users',
        targetColumn: 'id',
        type: 'one-to-many',
        onDelete: 'CASCADE'
      },
      {
        id: 'rel-order-items-orders',
        name: 'order_items_order_id_fkey',
        sourceTable: 'order_items',
        sourceColumn: 'order_id',
        targetTable: 'orders',
        targetColumn: 'id',
        type: 'one-to-many',
        onDelete: 'CASCADE'
      },
      {
        id: 'rel-order-items-products',
        name: 'order_items_product_id_fkey',
        sourceTable: 'order_items',
        sourceColumn: 'product_id',
        targetTable: 'products',
        targetColumn: 'id',
        type: 'one-to-many',
        onDelete: 'RESTRICT'
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
        id: 'rls-orders-own-data',
        tableName: 'orders',
        name: 'orders_own_data',
        command: 'ALL',
        using: 'auth.uid() = user_id',
        roles: ['authenticated']
      },
      {
        id: 'rls-order-items-own-data',
        tableName: 'order_items',
        name: 'order_items_own_data',
        command: 'ALL',
        using: 'EXISTS (SELECT 1 FROM orders WHERE orders.id = order_items.order_id AND orders.user_id = auth.uid())',
        roles: ['authenticated']
      },
      {
        id: 'rls-products-read-all',
        tableName: 'products',
        name: 'products_read_all',
        command: 'SELECT',
        using: 'is_active = true',
        roles: ['anon', 'authenticated']
      }
    ]
  }));

  return (
    <div className="h-screen overflow-auto">
      <MigrationPreview schema={schema} />
    </div>
  );
}