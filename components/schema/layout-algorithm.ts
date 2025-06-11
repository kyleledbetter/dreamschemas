import { Node } from '@xyflow/react';
import { Table, Relationship } from '@/types/schema.types';

export interface LayoutNode extends Node {
  id: string;
  position: { x: number; y: number };
  width?: number;
  height?: number;
}

export interface LayoutOptions {
  nodeWidth: number;
  nodeHeight: number;
  horizontalSpacing: number;
  verticalSpacing: number;
  algorithm: 'hierarchical' | 'force' | 'grid' | 'circular';
}

const DEFAULT_LAYOUT_OPTIONS: LayoutOptions = {
  nodeWidth: 280,
  nodeHeight: 200,
  horizontalSpacing: 150,
  verticalSpacing: 100,
  algorithm: 'hierarchical'
};

/**
 * Main auto-layout function that positions tables based on their relationships
 */
export function autoLayoutTables(
  tables: Table[],
  relationships: Relationship[],
  options: Partial<LayoutOptions> = {}
): { nodes: LayoutNode[] } {
  const opts = { ...DEFAULT_LAYOUT_OPTIONS, ...options };
  
  if (tables.length === 0) {
    return { nodes: [] };
  }

  switch (opts.algorithm) {
    case 'hierarchical':
      return hierarchicalLayout(tables, relationships, opts);
    case 'force':
      return forceDirectedLayout(tables, relationships, opts);
    case 'grid':
      return gridLayout(tables, opts);
    case 'circular':
      return circularLayout(tables, opts);
    default:
      return hierarchicalLayout(tables, relationships, opts);
  }
}

/**
 * Hierarchical layout - arranges tables in layers based on relationships
 * Tables with no incoming relationships are placed at the top
 */
function hierarchicalLayout(
  tables: Table[],
  relationships: Relationship[],
  options: LayoutOptions
): { nodes: LayoutNode[] } {
  // Build adjacency list and in-degree count
  const adjacencyList = new Map<string, string[]>();
  const inDegree = new Map<string, number>();
  const outDegree = new Map<string, number>();

  // Initialize all tables
  tables.forEach(table => {
    adjacencyList.set(table.name, []);
    inDegree.set(table.name, 0);
    outDegree.set(table.name, 0);
  });

  // Build graph from relationships
  relationships.forEach(rel => {
    const source = rel.sourceTable;
    const target = rel.targetTable;

    if (adjacencyList.has(source) && adjacencyList.has(target)) {
      adjacencyList.get(source)!.push(target);
      inDegree.set(target, (inDegree.get(target) || 0) + 1);
      outDegree.set(source, (outDegree.get(source) || 0) + 1);
    }
  });

  // Topological sort to determine layers
  const layers: string[][] = [];
  const visited = new Set<string>();
  const queue: string[] = [];

  // Start with nodes that have no incoming edges (root tables)
  tables.forEach(table => {
    if (inDegree.get(table.name) === 0) {
      queue.push(table.name);
    }
  });

  // If no root nodes, start with table that has most outgoing relationships
  if (queue.length === 0) {
    const maxOutDegree = Math.max(...Array.from(outDegree.values()));
    const rootTable = tables.find(table => outDegree.get(table.name) === maxOutDegree);
    if (rootTable) {
      queue.push(rootTable.name);
    }
  }

  // Build layers using modified BFS
  while (queue.length > 0) {
    const currentLayer: string[] = [];
    const layerSize = queue.length;

    for (let i = 0; i < layerSize; i++) {
      const tableName = queue.shift()!;
      if (visited.has(tableName)) continue;

      visited.add(tableName);
      currentLayer.push(tableName);

      // Add connected tables to next layer
      const connections = adjacencyList.get(tableName) || [];
      connections.forEach(connectedTable => {
        if (!visited.has(connectedTable) && !queue.includes(connectedTable)) {
          queue.push(connectedTable);
        }
      });
    }

    if (currentLayer.length > 0) {
      layers.push(currentLayer);
    }
  }

  // Add any remaining unvisited tables to the last layer
  const unvisited = tables.filter(table => !visited.has(table.name));
  if (unvisited.length > 0) {
    layers.push(unvisited.map(table => table.name));
  }

  // Position tables based on layers
  const nodes: LayoutNode[] = [];
  
  layers.forEach((layer, layerIndex) => {
    const layerY = layerIndex * (options.nodeHeight + options.verticalSpacing);
    const layerWidth = layer.length * options.nodeWidth + (layer.length - 1) * options.horizontalSpacing;
    const startX = -layerWidth / 2;

    layer.forEach((tableName, tableIndex) => {
      const table = tables.find(t => t.name === tableName)!;
      const x = startX + tableIndex * (options.nodeWidth + options.horizontalSpacing);
      
      nodes.push({
        id: table.id,
        position: { x, y: layerY },
        width: options.nodeWidth,
        height: options.nodeHeight,
        type: 'table',
        data: {}
      });
    });
  });

  return { nodes };
}

/**
 * Force-directed layout using a simplified version of the Fruchterman-Reingold algorithm
 */
function forceDirectedLayout(
  tables: Table[],
  relationships: Relationship[],
  options: LayoutOptions
): { nodes: LayoutNode[] } {
  const nodes: LayoutNode[] = tables.map((table) => ({
    id: table.id,
    position: {
      x: Math.random() * 800 - 400, // Random initial position
      y: Math.random() * 600 - 300
    },
    width: options.nodeWidth,
    height: options.nodeHeight,
    type: 'table',
    data: {}
  }));

  const k = Math.sqrt((800 * 600) / tables.length); // Optimal distance
  const iterations = 50;
  const cooling = 0.95;
  let temperature = 100;

  for (let iter = 0; iter < iterations; iter++) {
    // Calculate repulsive forces (all pairs)
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[i].position.x - nodes[j].position.x;
        const dy = nodes[i].position.y - nodes[j].position.y;
        const distance = Math.sqrt(dx * dx + dy * dy) || 0.1;

        const repulsiveForce = (k * k) / distance;
        const fx = (dx / distance) * repulsiveForce;
        const fy = (dy / distance) * repulsiveForce;

        nodes[i].position.x += fx * temperature * 0.01;
        nodes[i].position.y += fy * temperature * 0.01;
        nodes[j].position.x -= fx * temperature * 0.01;
        nodes[j].position.y -= fy * temperature * 0.01;
      }
    }

    // Calculate attractive forces (connected nodes)
    relationships.forEach(rel => {
      const sourceNode = nodes.find(n => tables.find(t => t.id === n.id)?.name === rel.sourceTable);
      const targetNode = nodes.find(n => tables.find(t => t.id === n.id)?.name === rel.targetTable);

      if (sourceNode && targetNode) {
        const dx = targetNode.position.x - sourceNode.position.x;
        const dy = targetNode.position.y - sourceNode.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy) || 0.1;

        const attractiveForce = (distance * distance) / k;
        const fx = (dx / distance) * attractiveForce;
        const fy = (dy / distance) * attractiveForce;

        sourceNode.position.x += fx * temperature * 0.01;
        sourceNode.position.y += fy * temperature * 0.01;
        targetNode.position.x -= fx * temperature * 0.01;
        targetNode.position.y -= fy * temperature * 0.01;
      }
    });

    temperature *= cooling;
  }

  return { nodes };
}

/**
 * Simple grid layout - arranges tables in a regular grid
 */
function gridLayout(tables: Table[], options: LayoutOptions): { nodes: LayoutNode[] } {
  const cols = Math.ceil(Math.sqrt(tables.length));
  
  const nodes: LayoutNode[] = tables.map((table, index) => {
    const row = Math.floor(index / cols);
    const col = index % cols;
    
    return {
      id: table.id,
      position: {
        x: col * (options.nodeWidth + options.horizontalSpacing),
        y: row * (options.nodeHeight + options.verticalSpacing)
      },
      width: options.nodeWidth,
      height: options.nodeHeight,
      type: 'table',
      data: {}
    };
  });

  return { nodes };
}

/**
 * Circular layout - arranges tables in a circle
 */
function circularLayout(tables: Table[], options: LayoutOptions): { nodes: LayoutNode[] } {
  const radius = Math.max(200, tables.length * 30);
  const angleStep = (2 * Math.PI) / tables.length;

  const nodes: LayoutNode[] = tables.map((table, index) => {
    const angle = index * angleStep;
    
    return {
      id: table.id,
      position: {
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius
      },
      width: options.nodeWidth,
      height: options.nodeHeight,
      type: 'table',
      data: {}
    };
  });

  return { nodes };
}

/**
 * Analyzes the schema to suggest the best layout algorithm
 */
export function suggestLayoutAlgorithm(
  tables: Table[],
  relationships: Relationship[]
): LayoutOptions['algorithm'] {
  const tableCount = tables.length;
  const relationshipCount = relationships.length;
  const density = relationshipCount / Math.max(tableCount * (tableCount - 1) / 2, 1);

  // For small schemas, use hierarchical
  if (tableCount <= 5) {
    return 'hierarchical';
  }

  // For dense schemas, use force-directed
  if (density > 0.3) {
    return 'force';
  }

  // For sparse schemas with clear hierarchy, use hierarchical
  if (density < 0.1 && hasHierarchicalStructure(tables, relationships)) {
    return 'hierarchical';
  }

  // Default to grid for medium-sized schemas
  return 'grid';
}

/**
 * Checks if the schema has a hierarchical structure
 */
function hasHierarchicalStructure(tables: Table[], relationships: Relationship[]): boolean {
  const inDegree = new Map<string, number>();
  
  tables.forEach(table => {
    inDegree.set(table.name, 0);
  });

  relationships.forEach(rel => {
    inDegree.set(rel.targetTable, (inDegree.get(rel.targetTable) || 0) + 1);
  });

  const rootTables = Array.from(inDegree.entries()).filter(([, degree]) => degree === 0);

  // A hierarchical structure should have clear root and leaf nodes
  return rootTables.length > 0 && rootTables.length < tables.length / 2;
}