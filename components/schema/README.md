# Schema Visualizer Components

A complete React Flow-based visual schema editor for PostgreSQL database schemas, built for the Dreamschema project. This component suite provides an interactive, drag-and-drop interface for visualizing and editing database schemas with real-time validation.

## Features

### 🎨 Visual Schema Editor
- **Interactive table nodes** with column details and type indicators
- **Drag-and-drop positioning** with snap-to-grid support
- **Relationship visualization** with proper foreign key connections
- **Real-time validation** with error highlighting
- **Mobile responsive design** with collapsible sidebar

### 🔧 Editing Capabilities
- **Table management**: Create, edit, delete, and duplicate tables
- **Column editing**: Add/remove columns with type selection and constraints
- **Relationship management**: Create foreign key relationships with visual connections
- **Auto-layout algorithms**: Hierarchical, force-directed, grid, and circular layouts
- **Schema validation**: Real-time error checking with detailed feedback

### 🎛️ Interactive Controls
- **Toolbar**: Auto-layout, zoom controls, grid toggle, fullscreen mode
- **Sidebar editor**: Detailed property editing for tables, columns, and relationships
- **Validation panel**: View and fix schema errors and warnings
- **Mini-map**: Navigate large schemas easily

## Components

### `SchemaVisualizer`
Main component that provides the complete visual schema editing experience.

```tsx
import { SchemaVisualizer } from '@/components/schema';

<SchemaVisualizer
  schema={databaseSchema}
  onSchemaChange={handleSchemaChange}
  readOnly={false}
  className="h-full"
/>
```

**Props:**
- `schema`: DatabaseSchema - The schema to visualize
- `onSchemaChange`: (schema: DatabaseSchema) => void - Callback for schema updates
- `readOnly?`: boolean - Disable editing capabilities
- `className?`: string - Additional CSS classes

### `TableNode`
Custom React Flow node component representing database tables.

Features:
- Column list with types and constraints
- Visual indicators for primary keys, foreign keys, and constraints
- Context menu for table operations
- Connection handles for relationship creation

### `RelationshipEdge`
Custom React Flow edge component for foreign key relationships.

Features:
- Relationship type indicators (1:1, 1:N, N:M)
- Column mapping display
- Referential action indicators (CASCADE, SET NULL, etc.)
- Context menu for relationship editing

### `SchemaEditorPanel`
Sidebar component for detailed schema editing.

Features:
- Tabbed interface (Schema, Table, Relationship, Validation)
- Property forms with validation
- Real-time error display
- Mobile-responsive design

### `LayoutAlgorithm`
Auto-layout utilities for table positioning.

Available algorithms:
- **Hierarchical**: Arranges tables in layers based on relationships
- **Force-directed**: Physics-based layout for natural positioning
- **Grid**: Simple grid arrangement
- **Circular**: Circular arrangement around center

## Usage Examples

### Basic Setup

```tsx
import React, { useState } from 'react';
import { SchemaVisualizer } from '@/components/schema';
import type { DatabaseSchema } from '@/types/schema.types';

function MySchemaEditor() {
  const [schema, setSchema] = useState<DatabaseSchema>(initialSchema);

  return (
    <div className="h-screen">
      <SchemaVisualizer
        schema={schema}
        onSchemaChange={setSchema}
      />
    </div>
  );
}
```

### Read-Only Visualization

```tsx
<SchemaVisualizer
  schema={schema}
  onSchemaChange={() => {}} // No-op for read-only
  readOnly={true}
/>
```

### Custom Layout

```tsx
import { autoLayoutTables } from '@/components/schema';

const { nodes } = autoLayoutTables(
  schema.tables,
  schema.relationships,
  { algorithm: 'hierarchical' }
);

// Apply positions to schema
const updatedSchema = {
  ...schema,
  tables: schema.tables.map(table => {
    const node = nodes.find(n => n.id === table.id);
    return node ? { ...table, position: node.position } : table;
  })
};
```

### Validation

```tsx
import { createSchemaValidator } from '@/components/schema';

const validator = createSchemaValidator(schema);
const result = validator.validateSchema();

if (!result.isValid) {
  console.log('Errors:', result.errors);
  console.log('Warnings:', result.warnings);
}
```

## Schema Data Structure

The visualizer works with the following TypeScript interfaces:

```tsx
interface DatabaseSchema {
  id: string;
  name: string;
  tables: Table[];
  relationships: Relationship[];
  rlsPolicies: RLSPolicy[];
  version: string;
  createdAt: Date;
  updatedAt: Date;
}

interface Table {
  id: string;
  name: string;
  columns: Column[];
  indexes: Index[];
  comment?: string;
  position?: { x: number; y: number };
}

interface Column {
  id: string;
  name: string;
  type: PostgresType;
  length?: number;
  precision?: number;
  scale?: number;
  nullable: boolean;
  defaultValue?: string;
  constraints: ColumnConstraint[];
  comment?: string;
}

interface Relationship {
  id: string;
  sourceTable: string;
  sourceColumn: string;
  targetTable: string;
  targetColumn: string;
  type: 'one-to-one' | 'one-to-many' | 'many-to-many';
  onDelete?: 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION';
  onUpdate?: 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION';
}
```

## Styling and Customization

The components use Tailwind CSS and are fully themeable. Key CSS classes:

```css
/* Table nodes */
.react-flow__node-table {
  min-width: 280px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}

/* Selected state */
.react-flow__node-table.selected {
  ring: 2px solid #3b82f6;
}

/* Relationship edges */
.react-flow__edge-relationship {
  stroke-width: 2px;
  stroke: #6b7280;
}

/* Mobile responsive */
@media (max-width: 768px) {
  .schema-sidebar {
    width: 100%;
    height: 33%;
  }
}
```

## Mobile Support

The visualizer is fully responsive:

- **Desktop**: Full sidebar with detailed editing
- **Tablet**: Collapsible sidebar with touch support
- **Mobile**: Bottom panel with essential controls

## Performance Considerations

- **Large schemas**: Use pagination or filtering for 50+ tables
- **Real-time validation**: Debounced to prevent excessive re-renders
- **Layout algorithms**: Force-directed layout may be slow for large schemas
- **Memory usage**: Nodes and edges are memoized for performance

## Integration with React Flow

The visualizer extends React Flow v12 with:

- Custom node types for tables
- Custom edge types for relationships
- Enhanced controls and panels
- Mobile-responsive layout
- Keyboard shortcuts support

## Accessibility

- **Keyboard navigation**: Full keyboard support for all interactions
- **Screen reader support**: Proper ARIA labels and descriptions
- **Color contrast**: Meets WCAG 2.1 AA standards
- **Focus management**: Clear focus indicators throughout

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Dependencies

- `@xyflow/react` v12.6.4+
- `react` v19.0.0+
- `tailwindcss` v3.4.1+
- `lucide-react` for icons

## Known Limitations

1. **Large schemas**: Performance may degrade with 100+ tables
2. **Complex relationships**: Many-to-many relationships require junction tables
3. **Undo/redo**: Not implemented in current version
4. **Collaborative editing**: Real-time collaboration not supported

## Future Enhancements

- [ ] Undo/redo functionality
- [ ] Schema diff and merge tools
- [ ] Export to various formats (SQL, Prisma, TypeORM)
- [ ] Collaborative editing support
- [ ] Advanced search and filtering
- [ ] Schema templates and snippets