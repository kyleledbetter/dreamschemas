"use client";

import React, { useState, useEffect } from "react";
import {
  Database,
  Plus,
  Settings,
  ExternalLink,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Clock,
  Users,
  Globe,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getSupabaseOAuth, type OAuthState } from "@/lib/supabase/oauth";
import type { SupabaseProject } from "@/lib/supabase/management";
import type { WorkflowState } from "@/lib/workflow/state-manager";

interface ProjectSelectorProps {
  onProjectSelect?: (project: SupabaseProject) => void;
  onCreateProject?: (project: SupabaseProject) => void;
  className?: string;
  workflowState?: Omit<WorkflowState, "id" | "timestamp">;
}

export function ProjectSelector({
  onProjectSelect,
  onCreateProject,
  className = "",
  workflowState,
}: ProjectSelectorProps) {
  const [oauthState, setOauthState] = useState<OAuthState>({
    isConnected: false,
    isLoading: false,
  });

  useEffect(() => {
    const oauth = getSupabaseOAuth();
    const unsubscribe = oauth.subscribe(setOauthState);
    return unsubscribe;
  }, []);

  const oauth = getSupabaseOAuth();

  const handleConnect = async () => {
    try {
      await oauth.startOAuth(workflowState);
    } catch (error) {
      console.error("Failed to start OAuth:", error);
    }
  };

  const handleRefresh = async () => {
    try {
      await oauth.loadUserData();
    } catch (error) {
      console.error("Failed to refresh data:", error);
    }
  };

  const handleOrganizationChange = (organizationId: string) => {
    const organization = oauthState.organizations?.find(
      (org) => org.id === organizationId
    );
    if (organization) {
      oauth.selectOrganization(organization);
    }
  };

  const handleProjectSelect = (projectId: string) => {
    const project = oauthState.projects?.find((p) => p.id === projectId);
    if (project) {
      oauth.selectProject(project);
      onProjectSelect?.(project);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "ACTIVE_HEALTHY":
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case "INACTIVE":
        return <AlertCircle className="h-4 w-4 text-orange-600" />;
      case "COMING_UP":
      case "GOING_DOWN":
        return <Clock className="h-4 w-4 text-blue-600" />;
      case "RESTORING":
        return <RefreshCw className="h-4 w-4 text-blue-600 animate-spin" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-600" />;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "ACTIVE_HEALTHY":
        return "Healthy";
      case "INACTIVE":
        return "Inactive";
      case "COMING_UP":
        return "Starting";
      case "GOING_DOWN":
        return "Stopping";
      case "RESTORING":
        return "Restoring";
      default:
        return "Unknown";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "ACTIVE_HEALTHY":
        return "bg-green-100 text-green-800";
      case "INACTIVE":
        return "bg-orange-100 text-orange-800";
      case "COMING_UP":
      case "GOING_DOWN":
      case "RESTORING":
        return "bg-blue-100 text-blue-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getTierIcon = (tier: string) => {
    switch (tier.toLowerCase()) {
      case "free":
        return <Globe className="h-3 w-3" />;
      case "pro":
        return <Zap className="h-3 w-3" />;
      case "team":
        return <Users className="h-3 w-3" />;
      default:
        return <Database className="h-3 w-3" />;
    }
  };

  // Filter projects by selected organization
  const filteredProjects = oauthState.selectedOrganization
    ? oauthState.projects?.filter(
        (p) => p.organization_id === oauthState.selectedOrganization!.id
      )
    : oauthState.projects;

  if (!oauthState.isConnected) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Connect to Supabase
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center space-y-4">
            <p className="text-muted-foreground">
              Connect your Supabase account to deploy schemas and manage
              projects.
            </p>

            <Button
              onClick={handleConnect}
              disabled={oauthState.isLoading}
              className="gap-2"
            >
              {oauthState.isLoading ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <ExternalLink className="h-4 w-4" />
              )}
              Connect Supabase Account
            </Button>

            {oauthState.error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-800">
                {oauthState.error}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Connection Status */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              Connected to Supabase
            </CardTitle>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRefresh}
                disabled={oauthState.isLoading}
                className="gap-1"
              >
                <RefreshCw
                  className={`h-3 w-3 ${
                    oauthState.isLoading ? "animate-spin" : ""
                  }`}
                />
                Refresh
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => oauth.disconnect()}
                className="text-red-600 hover:text-red-700"
              >
                Disconnect
              </Button>
            </div>
          </div>
        </CardHeader>

        {oauthState.user && (
          <CardContent className="pt-0">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Signed in as</span>
              <span className="font-medium">{oauthState.user.email}</span>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Organization Selection */}
      {oauthState.organizations && oauthState.organizations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Select Organization</CardTitle>
          </CardHeader>
          <CardContent>
            <Select
              value={oauthState.selectedOrganization?.id || ""}
              onValueChange={handleOrganizationChange}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choose an organization..." />
              </SelectTrigger>
              <SelectContent>
                {oauthState.organizations.map((org) => (
                  <SelectItem key={org.id} value={org.id}>
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      <span>{org.name || "Unnamed Organization"}</span>
                      {org.members?.length && (
                        <Badge variant="outline" className="ml-auto">
                          {org.members?.length} member
                          {org.members?.length !== 1 ? "s" : ""}
                        </Badge>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      )}

      {/* Project Selection */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Select Project</CardTitle>

            {onCreateProject && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onCreateProject?.({} as SupabaseProject)}
                className="gap-1"
              >
                <Plus className="h-3 w-3" />
                New Project
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent>
          {oauthState.isLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredProjects && filteredProjects.length > 0 ? (
            <div className="space-y-3">
              {filteredProjects.map((project) => (
                <div
                  key={project.id}
                  className={`
                    p-3 border rounded-lg cursor-pointer transition-colors
                    ${
                      oauthState.selectedProject?.id === project.id
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-muted/50"
                    }
                  `}
                  onClick={() => handleProjectSelect(project.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Database className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <div className="font-medium">{project.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {project.region} • {project.database.version}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {project.status && (
                        <Badge
                          variant="outline"
                          className={`gap-1 ${getStatusColor(project.status)}`}
                        >
                          {getStatusIcon(project.status)}
                          {getStatusLabel(project.status)}
                        </Badge>
                      )}

                      {project.subscription_tier && (
                        <Badge variant="outline" className="gap-1">
                          {getTierIcon(project.subscription_tier)}
                          {project.subscription_tier}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 space-y-3">
              <Database className="h-12 w-12 mx-auto text-muted-foreground" />
              <div>
                <p className="font-medium">No projects found</p>
                <p className="text-sm text-muted-foreground">
                  {oauthState.selectedOrganization
                    ? `No projects in ${oauthState.selectedOrganization.name}`
                    : "No projects available"}
                </p>
              </div>
              {onCreateProject && (
                <Button
                  onClick={() => onCreateProject?.({} as SupabaseProject)}
                  className="gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Create Your First Project
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Selected Project Details */}
      {oauthState.selectedProject && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Project Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Name:</span>
                  <p className="font-medium">
                    {oauthState.selectedProject.name}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Status:</span>
                  <div className="flex items-center gap-1">
                    {getStatusIcon(oauthState.selectedProject.status)}
                    <span className="font-medium">
                      {getStatusLabel(oauthState.selectedProject.status)}
                    </span>
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground">Region:</span>
                  <p className="font-medium">
                    {oauthState.selectedProject.region}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Tier:</span>
                  <p className="font-medium">
                    {oauthState.selectedProject.subscription_tier}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Database:</span>
                  <p className="font-medium">
                    {oauthState.selectedProject.database.version}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Created:</span>
                  <p className="font-medium">
                    {new Date(
                      oauthState.selectedProject.created_at
                    ).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
