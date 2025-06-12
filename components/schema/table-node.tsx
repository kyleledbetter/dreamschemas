"use client";

import React, { memo } from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Table, Column, PostgresType } from "@/types/schema.types";
import {
  Key,
  Link,
  MoreVertical,
  Plus,
  Trash2,
  Edit3,
  Hash,
  Type,
  Calendar,
  ToggleLeft,
  FileText,
  Link2,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface TableNodeData extends Record<string, unknown> {
  table: Table;
  onTableChange?: (table: Table) => void;
  onTableDelete?: (tableId: string) => void;
  selected?: boolean;
  readOnly?: boolean;
}

export interface TableNodeProps extends NodeProps {
  data: TableNodeData;
}

// Icon mapping for PostgreSQL types
const getTypeIcon = (type: PostgresType) => {
  switch (type) {
    case "INTEGER":
    case "BIGINT":
    case "SMALLINT":
    case "NUMERIC":
    case "DECIMAL":
    case "REAL":
    case "DOUBLE PRECISION":
      return Hash;
    case "VARCHAR":
    case "TEXT":
    case "CHAR":
      return Type;
    case "DATE":
    case "TIME":
    case "TIMESTAMP":
    case "TIMESTAMPTZ":
      return Calendar;
    case "BOOLEAN":
      return ToggleLeft;
    case "UUID":
      return Key;
    case "JSONB":
    case "JSON":
      return FileText;
    case "ARRAY":
      return Link2;
    default:
      return Type;
  }
};

// Note: Color mapping function removed as it's not currently used

const TableNode = memo(({ data, selected }: TableNodeProps) => {
  const { table, onTableChange, onTableDelete, readOnly } = data;

  const handleAddColumn = () => {
    if (readOnly || !onTableChange) return;

    const newColumn: Column = {
      id: `col_${Date.now()}`,
      name: "new_column",
      type: "VARCHAR",
      length: 255,
      nullable: true,
      constraints: [],
      defaultValue: "",
      comment: "",
    };

    const updatedTable = {
      ...table,
      columns: [...table.columns, newColumn],
    };

    onTableChange(updatedTable);
  };

  const handleDeleteColumn = (columnId: string) => {
    if (readOnly || !onTableChange) return;

    const updatedTable = {
      ...table,
      columns: table.columns.filter((col) => col.id !== columnId),
    };

    onTableChange(updatedTable);
  };

  const handleDeleteTable = () => {
    if (readOnly || !onTableDelete) return;
    onTableDelete(table.id);
  };

  const handleDuplicateTable = () => {
    if (readOnly || !onTableChange) return;

    const duplicatedTable: Table = {
      ...table,
      id: `table_${Date.now()}`,
      name: `${table.name}_copy`,
      position: {
        x: (table.position?.x || 0) + 50,
        y: (table.position?.y || 0) + 50,
      },
    };

    onTableChange(duplicatedTable);
  };

  const getPrimaryKeyColumns = () => {
    return table.columns.filter((col) =>
      col.constraints.some((constraint) => constraint.type === "PRIMARY KEY")
    );
  };

  const getForeignKeyColumns = () => {
    return table.columns.filter((col) =>
      col.constraints.some((constraint) => constraint.type === "FOREIGN KEY")
    );
  };

  // Check if table has validation errors
  const hasErrors = false; // TODO: Implement error checking based on validation result

  // Check if mobile viewport
  const [isMobile, setIsMobile] = React.useState(false);

  React.useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  return (
    <>
      <Card
        className={cn(
          "shadow-lg transition-all duration-200",
          isMobile ? "min-w-56 text-sm" : "min-w-64",
          selected ? "ring-2 ring-blue-500 shadow-xl" : "hover:shadow-xl",
          hasErrors ? "border-red-300" : "border-gray-200"
        )}
      >
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-500 rounded-full flex-shrink-0" />
              <h3 className="font-semibold text-sm truncate">{table.name}</h3>
              {hasErrors && <AlertCircle className="h-4 w-4 text-red-500" />}
            </div>

            {!readOnly && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                    <MoreVertical className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem>
                    <Edit3 className="h-4 w-4 mr-2" />
                    Edit Table
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleAddColumn}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Column
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleDuplicateTable}>
                    <Link2 className="h-4 w-4 mr-2" />
                    Duplicate
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={handleDeleteTable}
                    className="text-red-600 focus:text-red-600"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Table
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          {/* Table metadata */}
          <div className="flex flex-wrap gap-1 mt-2">
            {getPrimaryKeyColumns().length > 0 && (
              <Badge
                variant="outline"
                className={cn(
                  "bg-blue-50 text-blue-700",
                  isMobile ? "text-xs" : "text-xs"
                )}
              >
                <Key className="h-2 w-2 mr-1" />
                {isMobile
                  ? getPrimaryKeyColumns().length
                  : `PK: ${getPrimaryKeyColumns().length}`}
              </Badge>
            )}
            {getForeignKeyColumns().length > 0 && (
              <Badge
                variant="outline"
                className={cn(
                  "bg-purple-50 text-purple-700",
                  isMobile ? "text-xs" : "text-xs"
                )}
              >
                <Link className="h-2 w-2 mr-1" />
                {isMobile
                  ? getForeignKeyColumns().length
                  : `FK: ${getForeignKeyColumns().length}`}
              </Badge>
            )}
            <Badge variant="outline" className="text-xs">
              {table.columns.length} {isMobile ? "col" : "columns"}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="pt-0 space-y-1">
          {table.columns.map((column, index) => {
            const TypeIcon = getTypeIcon(column.type);
            const primaryKeyConstraint = column.constraints.find(
              (c) => c.type === "PRIMARY KEY"
            );
            const foreignKeyConstraint = column.constraints.find(
              (c) => c.type === "FOREIGN KEY"
            );
            const uniqueConstraint = column.constraints.find(
              (c) => c.type === "UNIQUE"
            );

            return (
              <div
                key={column.id}
                className={cn(
                  "flex items-center justify-between p-2 rounded text-xs transition-colors",
                  "hover:bg-gray-50",
                  primaryKeyConstraint
                    ? "bg-blue-50 border-l-2 border-blue-500"
                    : foreignKeyConstraint
                    ? "bg-purple-50 border-l-2 border-purple-500"
                    : "bg-gray-50"
                )}
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <TypeIcon className="h-3 w-3 text-gray-500 flex-shrink-0" />
                  <span
                    className={cn(
                      "font-medium truncate",
                      isMobile ? "text-xs" : ""
                    )}
                  >
                    {column.name}
                  </span>
                  {!isMobile && (
                    <span className="text-gray-500 text-xs">
                      {column.type}
                      {column.length && `(${column.length})`}
                      {column.precision &&
                        column.scale &&
                        `(${column.precision},${column.scale})`}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1 flex-shrink-0">
                  {primaryKeyConstraint && (
                    <Key className="h-3 w-3 text-blue-600" />
                  )}
                  {foreignKeyConstraint && (
                    <Link className="h-3 w-3 text-purple-600" />
                  )}
                  {uniqueConstraint && (
                    <span className="text-green-600 text-xs font-bold">U</span>
                  )}
                  {!column.nullable && (
                    <span
                      className="text-red-600 text-xs font-bold"
                      title="Not Null"
                    >
                      !
                    </span>
                  )}

                  {!readOnly && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-4 w-4 p-0 opacity-0 group-hover:opacity-100"
                        >
                          <MoreVertical className="h-2 w-2" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>
                          <Edit3 className="h-3 w-3 mr-2" />
                          Edit Column
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => handleDeleteColumn(column.id)}
                          className="text-red-600 focus:text-red-600"
                        >
                          <Trash2 className="h-3 w-3 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>

                {/* Connection handles for relationships */}
                <Handle
                  type="source"
                  position={Position.Right}
                  id={`${table.id}-${column.id}`}
                  className="!w-2 !h-2 !bg-blue-500 !rounded-full !border-2 !border-white"
                  style={{
                    top: `${(index + 1) * 30 + 60}px`,
                    opacity: 0,
                  }}
                />
                <Handle
                  type="target"
                  position={Position.Left}
                  id={`${table.id}-${column.id}`}
                  className="!w-2 !h-2 !bg-purple-500 !rounded-full !border-2 !border-white"
                  style={{
                    top: `${(index + 1) * 30 + 60}px`,
                    opacity: 0,
                  }}
                />
              </div>
            );
          })}

          {table.columns.length === 0 && (
            <div className="text-center text-gray-500 text-xs py-4">
              No columns defined
            </div>
          )}

          {table.comment && (
            <div className="text-xs text-gray-600 italic mt-2 pt-2 border-t">
              {table.comment}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Show handles on hover for better UX */}
      <style jsx>{`
        .react-flow__node:hover .react-flow__handle {
          opacity: 0.8 !important;
        }
        .react-flow__node:hover .react-flow__handle:hover {
          opacity: 1 !important;
        }
      `}</style>
    </>
  );
});

TableNode.displayName = "TableNode";

export { TableNode };
