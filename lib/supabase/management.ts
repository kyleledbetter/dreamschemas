import type { DatabaseSchema } from '@/types/schema.types';
import { generateMigrations, type MigrationOptions } from './migration-formatter';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  billing_email: string;
  created_at: string;
  members: Array<{
    id: string;
    email: string;
    role: string;
  }>;
}

export interface SupabaseProject {
  id: string;
  name: string;
  organization_id: string;
  region: string;
  created_at: string;
  status: string;
  database: {
    version: string;
    host?: string;
  };
  subscription_tier: string;
}

export interface OrganizationMember {
  id: string;
  primary_email: string;
  username: string;
  role: 'owner' | 'administrator' | 'developer';
}

export interface CreateProjectRequest {
  name: string;
  organization_id: string;
  plan?: 'free' | 'pro' | 'team' | 'enterprise';
  region?: string;
  kps_enabled?: boolean;
  db_pass?: string;
}

export interface CreateProjectResponse {
  id: string;
  name: string;
  organization_id: string;
  status: string;
  database: {
    host: string;
    version: string;
  };
  created_at: string;
  jwt_secret: string;
  anonymous_key: string;
  service_role_key: string;
}

export interface MigrationDeployment {
  id: string;
  project_id: string;
  name: string;
  status: 'pending' | 'applied' | 'failed' | 'reverted';
  sql: string;
  applied_at?: string;
  error_message?: string;
  created_by: string;
}

export interface DeploymentResult {
  success: boolean;
  migration_id?: string;
  error?: string;
  applied_at?: string;
  affected_tables?: string[];
  rollback_sql?: string;
  projectId?: string;
  projectName?: string;
  dbUrl?: string;
}

export interface TokenValidation {
  valid: boolean;
  error?: string;
  user?: {
    id: string;
    email: string;
    username?: string;
  };
}

/**
 * Supabase Management API client
 * Handles project management, migration deployment, and organization operations
 */
export class SupabaseManagementClient {
  private accessToken: string;
  private static readonly SUPABASE_API_BASE = 'https://api.supabase.com/v1';

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  private async fetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    // Determine if this is a local API call or a direct Supabase API call
    const url = endpoint.startsWith('/api/') 
      ? endpoint // Local API routes (relative)
      : `${SupabaseManagementClient.SUPABASE_API_BASE}${endpoint}`; // Direct Supabase API calls (absolute)

    const response = await fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`API request failed: ${error}`);
    }

    return response.json();
  }

  /**
   * Get user organizations
   */
  async getOrganizations(): Promise<Organization[]> {
    return this.fetch<Organization[]>('/api/supabase/organizations');
  }

  /**
   * Get projects for an organization
   */
  async getProjects(): Promise<SupabaseProject[]> {
    return this.fetch<SupabaseProject[]>('/api/supabase/projects');
  }

  /**
   * Get specific project details
   */
  async getProject(projectId: string): Promise<SupabaseProject> {
    return this.fetch<SupabaseProject>(`/projects/${projectId}`);
  }

  /**
   * Create a new Supabase project
   */
  async createProject(request: CreateProjectRequest): Promise<CreateProjectResponse> {
    return this.fetch<CreateProjectResponse>('/projects', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  /**
   * Delete a project
   */
  async deleteProject(projectId: string): Promise<void> {
    await this.fetch(`/projects/${projectId}`, {
      method: 'DELETE',
    });
  }

  /**
   * Execute SQL migration on a project
   */
  async executeMigration(
    projectId: string, 
    sql: string, 
    name?: string
  ): Promise<DeploymentResult> {
    try {
      const migration = {
        name: name || `Migration ${new Date().toISOString()}`,
        sql: sql.trim(),
      };

      const response = await this.fetch<{ success: boolean; results?: unknown[]; error?: string }>(
        `/projects/${projectId}/database/migrations`,
        {
          method: 'POST',
          body: JSON.stringify(migration),
        }
      );

      if (response.success) {
        return {
          success: true,
          migration_id: `migration_${Date.now()}`,
          applied_at: new Date().toISOString(),
          affected_tables: this.extractTableNames(sql),
        };
      } else {
        return {
          success: false,
          error: response.error || 'Migration failed',
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Deploy schema to Supabase project
   */
  async deploySchema(
    projectId: string,
    schema: DatabaseSchema,
    options: Partial<MigrationOptions> = {}
  ): Promise<DeploymentResult> {
    try {
      // Generate migration files
      const migrations = generateMigrations(schema, {
        format: 'migration',
        includeRLS: true,
        includeIndexes: true,
        includeComments: true,
        ...options,
      });

      if (migrations.length === 0) {
        return {
          success: false,
          error: 'No migration files generated',
        };
      }

      // Execute main migration
      const mainMigration = migrations[0];
      const result = await this.executeMigration(
        projectId,
        mainMigration.content,
        `Deploy ${schema.name} Schema`
      );

      if (!result.success) {
        return result;
      }

      // Execute additional migrations (RLS, etc.)
      for (let i = 1; i < migrations.length; i++) {
        const additionalMigration = migrations[i];
        const additionalResult = await this.executeMigration(
          projectId,
          additionalMigration.content,
          additionalMigration.description
        );

        if (!additionalResult.success) {
          // Return warning but don't fail the entire deployment
          console.warn(`Warning: ${additionalMigration.description} failed:`, additionalResult.error);
        }
      }

      return {
        ...result,
        affected_tables: this.getAllTableNames(schema),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Schema deployment failed',
      };
    }
  }

  /**
   * Get project database connection info
   */
  async getConnectionInfo(projectId: string): Promise<{
    host: string;
    database: string;
    port: number;
    user: string;
    connection_string: string;
  }> {
    return this.fetch(`/projects/${projectId}/database`);
  }

  /**
   * Get project API keys
   */
  async getApiKeys(projectId: string): Promise<{
    anon: string;
    service_role: string;
    jwt_secret: string;
  }> {
    return this.fetch(`/projects/${projectId}/api-keys`);
  }

  /**
   * Check project health status
   */
  async getProjectHealth(projectId: string): Promise<{
    status: 'healthy' | 'degraded' | 'down';
    database: 'online' | 'offline';
    api: 'online' | 'offline';
    auth: 'online' | 'offline';
    storage: 'online' | 'offline';
  }> {
    return this.fetch(`/projects/${projectId}/health`);
  }

  /**
   * Get migration history for a project
   */
  async getMigrationHistory(projectId: string): Promise<MigrationDeployment[]> {
    try {
      return await this.fetch<MigrationDeployment[]>(`/projects/${projectId}/database/migrations`);
    } catch (error) {
      // If endpoint doesn't exist, return empty array
      console.warn('Migration history not available:', error);
      return [];
    }
  }

  /**
   * Revert a migration
   */
  async revertMigration(
    projectId: string, 
    migrationId: string
  ): Promise<DeploymentResult> {
    try {
      await this.fetch(`/projects/${projectId}/database/migrations/${migrationId}/revert`, {
        method: 'POST',
      });

      return {
        success: true,
        applied_at: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Migration revert failed',
      };
    }
  }

  /**
   * Test connection to project database
   */
  async testConnection(projectId: string): Promise<{
    success: boolean;
    latency?: number;
    error?: string;
  }> {
    try {
      const startTime = Date.now();
      await this.fetch(`/projects/${projectId}/database/health`);
      const latency = Date.now() - startTime;

      return {
        success: true,
        latency,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Connection test failed',
      };
    }
  }

  /**
   * Generate rollback SQL for a schema
   */
  generateRollbackSQL(schema: DatabaseSchema): string {
    const lines: string[] = [];
    
    lines.push('-- Rollback SQL');
    lines.push(`-- Generated for schema: ${schema.name}`);
    lines.push(`-- Created at: ${new Date().toISOString()}`);
    lines.push('');

    // Drop tables in reverse dependency order
    const orderedTables = this.getTablesInDependencyOrder(schema).reverse();
    
    lines.push('-- Drop tables (in reverse dependency order)');
    orderedTables.forEach(table => {
      lines.push(`DROP TABLE IF EXISTS "${table.name}" CASCADE;`);
    });

    return lines.join('\n');
  }

  /**
   * Extract table names from SQL
   */
  private extractTableNames(sql: string): string[] {
    const tableRegex = /CREATE TABLE\s+"?(\w+)"?/gi;
    const tables: string[] = [];
    let match;

    while ((match = tableRegex.exec(sql)) !== null) {
      tables.push(match[1]);
    }

    return tables;
  }

  /**
   * Get all table names from schema
   */
  private getAllTableNames(schema: DatabaseSchema): string[] {
    return schema.tables.map(table => table.name);
  }

  /**
   * Get tables in dependency order
   */
  private getTablesInDependencyOrder(schema: DatabaseSchema): Array<{ name: string }> {
    const ordered: Array<{ name: string }> = [];
    const remaining = [...schema.tables.map(t => ({ name: t.name }))];
    const processing = new Set<string>();

    const addTable = (tableName: string) => {
      if (processing.has(tableName)) {
        return;
      }
      
      const table = remaining.find(t => t.name === tableName);
      if (!table || ordered.includes(table)) {
        return;
      }

      processing.add(tableName);

      // Add dependencies first
      const dependencies = schema.relationships
        .filter(rel => rel.sourceTable === tableName)
        .map(rel => rel.targetTable)
        .filter(target => target !== tableName);

      dependencies.forEach(dep => addTable(dep));

      ordered.push(table);
      remaining.splice(remaining.indexOf(table), 1);
      processing.delete(tableName);
    };

    while (remaining.length > 0) {
      addTable(remaining[0].name);
    }

    return ordered;
  }
}

/**
 * Create Supabase Management client with access token
 */
export function createSupabaseManagement(accessToken: string) {
  return new SupabaseManagementClient(accessToken);
}

/**
 * Validate Supabase access token
 */
export async function validateAccessToken(accessToken: string): Promise<TokenValidation> {
  try {
    const response = await fetch('/api/supabase/validate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ accessToken }),
    });

    if (!response.ok) {
      return {
        valid: false,
        error: 'Token validation failed',
      };
    }

    return response.json();
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Token validation failed',
    };
  }
}