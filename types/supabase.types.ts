export interface SupabaseProject {
  id: string;
  name: string;
  region: string;
  status: 'ACTIVE_HEALTHY' | 'ACTIVE_UNHEALTHY' | 'COMING_UP' | 'GOING_DOWN' | 'INACTIVE' | 'UNKNOWN';
  database: {
    host: string;
    port: number;
    version: string;
  };
  created_at: string;
  updated_at: string;
  organization_id: string;
  api_keys: {
    anon: string;
    service_role: string;
  };
  api_url: string;
  db_url: string;
  studio_url: string;
  inactivity_timeout_minutes?: number;
}

export interface SupabaseOrganization {
  id: string;
  name: string;
  billing_email: string;
  project_limit: number;
  members: SupabaseOrganizationMember[];
}

export interface SupabaseOrganizationMember {
  id: string;
  email: string;
  role: 'owner' | 'admin' | 'member';
  status: 'active' | 'pending';
}

export interface SupabaseAuthUser {
  id: string;
  email: string;
  email_confirmed_at: string | null;
  created_at: string;
  updated_at: string;
  last_sign_in_at: string | null;
  app_metadata: Record<string, unknown>;
  user_metadata: Record<string, unknown>;
  identities: SupabaseIdentity[];
}

export interface SupabaseIdentity {
  id: string;
  provider: string;
  email: string;
  created_at: string;
  updated_at: string;
}

export interface SupabaseConnection {
  user: SupabaseAuthUser;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  organizations: SupabaseOrganization[];
  selectedOrganization?: SupabaseOrganization;
  selectedProject?: SupabaseProject;
}

export interface SupabaseMigrationRequest {
  projectId: string;
  migrationName: string;
  sql: string;
  runOnce?: boolean;
}

export interface SupabaseMigrationResponse {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  created_at: string;
  completed_at?: string;
  error?: string;
  logs?: string[];
}

export interface SupabaseBucket {
  id: string;
  name: string;
  owner: string;
  created_at: string;
  updated_at: string;
  public: boolean;
  avif_autodetection: boolean;
  file_size_limit?: number;
  allowed_mime_types?: string[];
}

export interface SupabaseStorageObject {
  name: string;
  id: string;
  updated_at: string;
  created_at: string;
  last_accessed_at: string;
  metadata: Record<string, unknown>;
  bucket_id: string;
  size: number;
}

export interface SupabaseProjectCreateRequest {
  name: string;
  organization_id: string;
  region?: string;
  plan?: 'free' | 'pro' | 'team' | 'enterprise';
  kps_enabled?: boolean;
  db_pass?: string;
}

export interface SupabaseTableInfo {
  table_name: string;
  schema_name: string;
  column_count: number;
  row_count_estimate: number;
  table_size: string;
  columns: SupabaseColumnInfo[];
  indexes: SupabaseIndexInfo[];
  foreign_keys: SupabaseForeignKeyInfo[];
}

export interface SupabaseColumnInfo {
  column_name: string;
  data_type: string;
  is_nullable: boolean;
  column_default: string | null;
  character_maximum_length: number | null;
  numeric_precision: number | null;
  numeric_scale: number | null;
  is_identity: boolean;
  is_generated: boolean;
}

export interface SupabaseIndexInfo {
  index_name: string;
  table_name: string;
  column_names: string[];
  is_unique: boolean;
  index_type: string;
  condition: string | null;
}

export interface SupabaseForeignKeyInfo {
  constraint_name: string;
  table_name: string;
  column_name: string;
  foreign_table_name: string;
  foreign_column_name: string;
  on_delete: string;
  on_update: string;
}

export interface SupabaseRLSPolicy {
  id: string;
  schema_name: string;
  table_name: string;
  policy_name: string;
  command: string;
  permissive: boolean;
  roles: string[];
  qual: string | null;
  with_check: string | null;
}

export interface SupabaseManagementError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  hint?: string;
}

export interface SupabaseDeploymentStatus {
  projectId: string;
  status: 'initializing' | 'creating-tables' | 'applying-migrations' | 'setting-up-auth' | 'configuring-storage' | 'completed' | 'failed';
  currentStep: string;
  progress: number; // 0-100
  logs: string[];
  error?: SupabaseManagementError;
  startedAt: Date;
  completedAt?: Date;
}

export interface SupabaseBackupInfo {
  id: string;
  project_id: string;
  status: 'scheduled' | 'running' | 'completed' | 'failed';
  created_at: string;
  completed_at?: string;
  size_bytes?: number;
  type: 'full' | 'incremental';
}