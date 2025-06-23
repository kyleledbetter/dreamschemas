"use client";

import React, { useState } from "react";
import { ProjectSelector } from "./project-selector";
import { ProjectCreator } from "./project-creator";
import { MigrationDeployer } from "./migration-deployer";
import { generateId } from "@/lib/utils/index";
import type { DatabaseSchema, Table, Relationship } from "@/types/schema.types";
import type {
  SupabaseProject,
  CreateProjectResponse,
  DeploymentResult,
} from "@/lib/supabase/management";

/**
 * Demo component showing complete Supabase Integration workflow
 * This demonstrates the full cycle from OAuth to project management to schema deployment
 */
export function SupabaseIntegrationDemo() {
  const [selectedProject, setSelectedProject] = useState<
    SupabaseProject | undefined
  >();
  const [showProjectCreator, setShowProjectCreator] = useState(false);
  const [, setDeploymentResult] = useState<DeploymentResult | undefined>();

  // Sample schema for demo purposes (e-commerce platform)
  const [schema] = useState<DatabaseSchema>(() => ({
    id: generateId(),
    name: "SaaS Platform",
    version: "1.0.0",
    createdAt: new Date(),
    updatedAt: new Date(),
    tables: [
      {
        id: "users-table",
        name: "users",
        comment: "Application users and authentication",
        position: { x: 100, y: 100 },
        columns: [
          {
            id: "users-id",
            name: "id",
            type: "UUID",
            nullable: false,
            defaultValue: "uuid_generate_v4()",
            constraints: [{ type: "PRIMARY KEY" }],
            comment: "Primary key",
          },
          {
            id: "users-email",
            name: "email",
            type: "TEXT",
            nullable: false,
            constraints: [
              { type: "UNIQUE" },
              {
                type: "CHECK",
                value:
                  "email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\\\.[A-Za-z]{2,}$'",
              },
            ],
            comment: "User email address",
          },
          {
            id: "users-full-name",
            name: "full_name",
            type: "TEXT",
            nullable: true,
            comment: "User full name",
          },
          {
            id: "users-avatar-url",
            name: "avatar_url",
            type: "TEXT",
            nullable: true,
            comment: "Profile picture URL",
          },
          {
            id: "users-subscription-tier",
            name: "subscription_tier",
            type: "TEXT",
            nullable: false,
            defaultValue: "'free'",
            constraints: [
              {
                type: "CHECK",
                value: "subscription_tier IN ('free', 'premium', 'enterprise')",
              },
            ],
            comment: "User subscription level",
          },
          {
            id: "users-created-at",
            name: "created_at",
            type: "TIMESTAMPTZ",
            nullable: false,
            defaultValue: "NOW()",
            constraints: [{ type: "NOT NULL" }],
          },
          {
            id: "users-updated-at",
            name: "updated_at",
            type: "TIMESTAMPTZ",
            nullable: false,
            defaultValue: "NOW()",
            constraints: [{ type: "NOT NULL" }],
          },
        ],
        indexes: [
          {
            id: "idx-users-email",
            name: "idx_users_email",
            columns: ["email"],
            unique: true,
          },
          {
            id: "idx-users-subscription",
            name: "idx_users_subscription_tier",
            columns: ["subscription_tier"],
            unique: false,
          },
        ],
      },
      {
        id: "workspaces-table",
        name: "workspaces",
        comment: "User workspaces and teams",
        position: { x: 400, y: 100 },
        columns: [
          {
            id: "workspaces-id",
            name: "id",
            type: "UUID",
            nullable: false,
            defaultValue: "uuid_generate_v4()",
            constraints: [{ type: "PRIMARY KEY" }],
          },
          {
            id: "workspaces-name",
            name: "name",
            type: "TEXT",
            nullable: false,
            constraints: [{ type: "NOT NULL" }],
            comment: "Workspace name",
          },
          {
            id: "workspaces-slug",
            name: "slug",
            type: "TEXT",
            nullable: false,
            constraints: [
              { type: "UNIQUE" },
              { type: "CHECK", value: "slug ~* '^[a-z0-9-]+$'" },
            ],
            comment: "URL-friendly workspace identifier",
          },
          {
            id: "workspaces-owner-id",
            name: "owner_id",
            type: "UUID",
            nullable: false,
            constraints: [
              {
                type: "FOREIGN KEY",
                referencedTable: "users",
                referencedColumn: "id",
                onDelete: "CASCADE",
              },
            ],
          },
          {
            id: "workspaces-settings",
            name: "settings",
            type: "JSONB",
            nullable: false,
            defaultValue: "'{}'",
            comment: "Workspace configuration",
          },
          {
            id: "workspaces-created-at",
            name: "created_at",
            type: "TIMESTAMPTZ",
            nullable: false,
            defaultValue: "NOW()",
          },
          {
            id: "workspaces-updated-at",
            name: "updated_at",
            type: "TIMESTAMPTZ",
            nullable: false,
            defaultValue: "NOW()",
          },
        ],
        indexes: [
          {
            id: "idx-workspaces-slug",
            name: "idx_workspaces_slug",
            columns: ["slug"],
            unique: true,
          },
          {
            id: "idx-workspaces-owner",
            name: "idx_workspaces_owner_id",
            columns: ["owner_id"],
            unique: false,
          },
        ],
      },
      {
        id: "workspace-members-table",
        name: "workspace_members",
        comment: "User membership in workspaces",
        position: { x: 700, y: 100 },
        columns: [
          {
            id: "workspace-members-id",
            name: "id",
            type: "UUID",
            nullable: false,
            defaultValue: "uuid_generate_v4()",
            constraints: [{ type: "PRIMARY KEY" }],
          },
          {
            id: "workspace-members-workspace-id",
            name: "workspace_id",
            type: "UUID",
            nullable: false,
            constraints: [
              {
                type: "FOREIGN KEY",
                referencedTable: "workspaces",
                referencedColumn: "id",
                onDelete: "CASCADE",
              },
            ],
          },
          {
            id: "workspace-members-user-id",
            name: "user_id",
            type: "UUID",
            nullable: false,
            constraints: [
              {
                type: "FOREIGN KEY",
                referencedTable: "users",
                referencedColumn: "id",
                onDelete: "CASCADE",
              },
            ],
          },
          {
            id: "workspace-members-role",
            name: "role",
            type: "TEXT",
            nullable: false,
            defaultValue: "'member'",
            constraints: [
              {
                type: "CHECK",
                value: "role IN ('owner', 'admin', 'member', 'viewer')",
              },
            ],
            comment: "User role in workspace",
          },
          {
            id: "workspace-members-invited-at",
            name: "invited_at",
            type: "TIMESTAMPTZ",
            nullable: false,
            defaultValue: "NOW()",
          },
          {
            id: "workspace-members-joined-at",
            name: "joined_at",
            type: "TIMESTAMPTZ",
            nullable: true,
            comment: "When user accepted invitation",
          },
        ],
        indexes: [
          {
            id: "idx-workspace-members-workspace",
            name: "idx_workspace_members_workspace_id",
            columns: ["workspace_id"],
            unique: false,
          },
          {
            id: "idx-workspace-members-user",
            name: "idx_workspace_members_user_id",
            columns: ["user_id"],
            unique: false,
          },
          {
            id: "idx-workspace-members-unique",
            name: "idx_workspace_members_unique",
            columns: ["workspace_id", "user_id"],
            unique: true,
          },
        ],
      },
      {
        id: "projects-table",
        name: "projects",
        comment: "User projects within workspaces",
        position: { x: 1000, y: 100 },
        columns: [
          {
            id: "projects-id",
            name: "id",
            type: "UUID",
            nullable: false,
            defaultValue: "uuid_generate_v4()",
            constraints: [{ type: "PRIMARY KEY" }],
          },
          {
            id: "projects-workspace-id",
            name: "workspace_id",
            type: "UUID",
            nullable: false,
            constraints: [
              {
                type: "FOREIGN KEY",
                referencedTable: "workspaces",
                referencedColumn: "id",
                onDelete: "CASCADE",
              },
            ],
          },
          {
            id: "projects-name",
            name: "name",
            type: "TEXT",
            nullable: false,
            constraints: [{ type: "NOT NULL" }],
            comment: "Project name",
          },
          {
            id: "projects-description",
            name: "description",
            type: "TEXT",
            nullable: true,
            comment: "Project description",
          },
          {
            id: "projects-status",
            name: "status",
            type: "TEXT",
            nullable: false,
            defaultValue: "'active'",
            constraints: [
              {
                type: "CHECK",
                value: "status IN ('active', 'archived', 'deleted')",
              },
            ],
          },
          {
            id: "projects-metadata",
            name: "metadata",
            type: "JSONB",
            nullable: false,
            defaultValue: "'{}'",
            comment: "Project metadata and settings",
          },
          {
            id: "projects-created-at",
            name: "created_at",
            type: "TIMESTAMPTZ",
            nullable: false,
            defaultValue: "NOW()",
          },
          {
            id: "projects-updated-at",
            name: "updated_at",
            type: "TIMESTAMPTZ",
            nullable: false,
            defaultValue: "NOW()",
          },
        ],
        indexes: [
          {
            id: "idx-projects-workspace",
            name: "idx_projects_workspace_id",
            columns: ["workspace_id"],
            unique: false,
          },
          {
            id: "idx-projects-status",
            name: "idx_projects_status",
            columns: ["status"],
            unique: false,
          },
        ],
      },
    ] as Table[],
    relationships: [
      {
        id: "rel-workspaces-users",
        name: "workspaces_owner_id_fkey",
        sourceTable: "workspaces",
        sourceColumn: "owner_id",
        targetTable: "users",
        targetColumn: "id",
        type: "one-to-many",
        onDelete: "CASCADE",
      },
      {
        id: "rel-workspace-members-workspaces",
        name: "workspace_members_workspace_id_fkey",
        sourceTable: "workspace_members",
        sourceColumn: "workspace_id",
        targetTable: "workspaces",
        targetColumn: "id",
        type: "one-to-many",
        onDelete: "CASCADE",
      },
      {
        id: "rel-workspace-members-users",
        name: "workspace_members_user_id_fkey",
        sourceTable: "workspace_members",
        sourceColumn: "user_id",
        targetTable: "users",
        targetColumn: "id",
        type: "one-to-many",
        onDelete: "CASCADE",
      },
      {
        id: "rel-projects-workspaces",
        name: "projects_workspace_id_fkey",
        sourceTable: "projects",
        sourceColumn: "workspace_id",
        targetTable: "workspaces",
        targetColumn: "id",
        type: "one-to-many",
        onDelete: "CASCADE",
      },
    ] as Relationship[],
    rlsPolicies: [
      {
        id: "rls-users-own-data",
        tableName: "users",
        name: "users_own_data",
        command: "ALL",
        using: "auth.uid() = id",
        roles: ["authenticated"],
      },
      {
        id: "rls-workspaces-member-access",
        tableName: "workspaces",
        name: "workspaces_member_access",
        command: "SELECT",
        using:
          "EXISTS (SELECT 1 FROM workspace_members WHERE workspace_members.workspace_id = workspaces.id AND workspace_members.user_id = auth.uid())",
        roles: ["authenticated"],
      },
      {
        id: "rls-workspaces-owner-manage",
        tableName: "workspaces",
        name: "workspaces_owner_manage",
        command: "ALL",
        using: "auth.uid() = owner_id",
        roles: ["authenticated"],
      },
      {
        id: "rls-workspace-members-access",
        tableName: "workspace_members",
        name: "workspace_members_access",
        command: "SELECT",
        using:
          "user_id = auth.uid() OR EXISTS (SELECT 1 FROM workspaces WHERE workspaces.id = workspace_members.workspace_id AND workspaces.owner_id = auth.uid())",
        roles: ["authenticated"],
      },
      {
        id: "rls-projects-workspace-access",
        tableName: "projects",
        name: "projects_workspace_access",
        command: "ALL",
        using:
          "EXISTS (SELECT 1 FROM workspace_members WHERE workspace_members.workspace_id = projects.workspace_id AND workspace_members.user_id = auth.uid())",
        roles: ["authenticated"],
      },
    ],
  }));

  const handleProjectSelect = (project: SupabaseProject) => {
    setSelectedProject(project);
    setShowProjectCreator(false);
  };

  const handleProjectCreated = (response: CreateProjectResponse) => {
    // Convert response to SupabaseProject format
    const newProject: SupabaseProject = {
      id: response.id,
      name: response.name,
      organization_id: response.organization_id,
      database: response.database,
      status: "ACTIVE_HEALTHY",
      created_at: response.created_at,
      region: "us-east-1", // Default region
      subscription_tier: "free", // Default tier
    };

    setSelectedProject(newProject);
    setShowProjectCreator(false);
  };

  const handleDeploymentComplete = (result: DeploymentResult) => {
    setDeploymentResult(result);
  };

  return (
    <div className="h-screen overflow-auto p-6 space-y-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">Supabase Integration Demo</h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Complete workflow from OAuth authentication to project management
            and schema deployment. This demo shows the full integration with
            Supabase&apos;s Management API.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column - Project Management */}
          <div className="space-y-6">
            {!showProjectCreator ? (
              <ProjectSelector
                onProjectSelect={handleProjectSelect}
                onCreateProject={() => setShowProjectCreator(true)}
              />
            ) : (
              <ProjectCreator
                schema={schema}
                onProjectCreated={handleProjectCreated}
                onCancel={() => setShowProjectCreator(false)}
              />
            )}
          </div>

          {/* Right Column - Migration Deployment */}
          <div className="space-y-6">
            {selectedProject ? (
              <MigrationDeployer
                schema={schema}
                project={selectedProject}
                onDeploymentComplete={handleDeploymentComplete}
              />
            ) : (
              <MigrationDeployer
                schema={schema}
                onDeploymentComplete={handleDeploymentComplete}
              />
            )}
          </div>
        </div>

        {/* Schema Summary */}
        <div className="mt-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-6 bg-muted/30 rounded-lg">
            <div className="text-center">
              <p className="text-2xl font-bold text-primary">
                {schema.tables.length}
              </p>
              <p className="text-sm text-muted-foreground">Tables</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-600">
                {schema.relationships.length}
              </p>
              <p className="text-sm text-muted-foreground">Relationships</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">
                {schema.rlsPolicies.length}
              </p>
              <p className="text-sm text-muted-foreground">RLS Policies</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-purple-600">
                {schema.tables.reduce(
                  (acc, table) => acc + table.indexes.length,
                  0
                )}
              </p>
              <p className="text-sm text-muted-foreground">Indexes</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
