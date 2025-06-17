'use client';

// import { createClient } from './client';
import { createSupabaseManagement } from './management';
import type { SupabaseProject, Organization } from './management';
import { WorkflowStateManager, type WorkflowState } from '@/lib/workflow/state-manager';

export interface OAuthState {
  isConnected: boolean;
  accessToken?: string;
  user?: {
    id: string;
    email: string;
    username?: string;
  };
  organizations?: Organization[];
  projects?: SupabaseProject[];
  selectedOrganization?: Organization;
  selectedProject?: SupabaseProject;
  error?: string;
  isLoading: boolean;
}

export interface OAuthConnection {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number | null;
  scope: string[];
  user: {
    id: string;
    email: string;
    username?: string;
  };
}

/**
 * Enhanced OAuth manager for Supabase management
 * Handles authentication, token management, and project access
 */
export class SupabaseOAuth {
  private static readonly STORAGE_KEY = 'supabase_management_oauth';
  private static readonly OAUTH_URL = 'https://api.supabase.com/v1/oauth/authorize';
  private static readonly CLIENT_ID = process.env.NEXT_PUBLIC_SUPABASE_OAUTH_CLIENT_ID;
  private static readonly CLIENT_SECRET = process.env.NEXT_PUBLIC_SUPABASE_OAUTH_CLIENT_SECRET;
  private static readonly REDIRECT_URI = typeof window !== 'undefined' 
    ? `${window.location.origin}/auth/supabase/callback`
    : 'http://localhost:3000/auth/supabase/callback';

  private connection: OAuthConnection | null = null;
  private listeners: Set<(state: OAuthState) => void> = new Set();
  private currentState: OAuthState = {
    isConnected: false,
    isLoading: false,
  };

  constructor() {
    this.loadFromStorage();
  }

  /**
   * Subscribe to OAuth state changes
   */
  subscribe(listener: (state: OAuthState) => void): () => void {
    this.listeners.add(listener);
    listener(this.currentState);
    
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Get current OAuth state
   */
  getState(): OAuthState {
    return { ...this.currentState };
  }

  /**
   * Start OAuth flow with workflow state preservation
   */
  async startOAuth(options?: { scopes?: string[] } | Omit<WorkflowState, 'id' | 'timestamp'>): Promise<void> {
    if (!SupabaseOAuth.CLIENT_ID) {
      throw new Error('Supabase OAuth client ID not configured');
    }

    const state = this.generateState();
    const codeVerifier = this.generateCodeVerifier();
    const codeChallenge = await this.generateCodeChallenge(codeVerifier);

    // Store PKCE parameters
    sessionStorage.setItem('oauth_state', state);
    sessionStorage.setItem('code_verifier', codeVerifier);

    // Store workflow state if provided and it's not just scopes
    let stateParam = state;
    if (options && 'step' in options) {
      const stateManager = WorkflowStateManager.getInstance();
      const stateId = stateManager.saveState(options);
      stateParam = `${state}:${stateId}`;
    }

    const params = new URLSearchParams({
      client_id: SupabaseOAuth.CLIENT_ID,
      redirect_uri: SupabaseOAuth.REDIRECT_URI,
      response_type: 'code',
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      state: stateParam,
      scope: [
        'all',
        'projects:read',
        'projects:write',
        'organizations:read',
        'organizations:write',
        'rest:read',
        'rest:execute'
      ].join(' ')
    });

    window.location.href = `${SupabaseOAuth.OAUTH_URL}?${params}`;
  }

  /**
   * Handle OAuth callback with workflow state restoration
   */
  async handleCallback(code: string, state: string): Promise<{ workflowState?: WorkflowState | null }> {
    console.log('OAuth handleCallback called with:', { code: code.substring(0, 10) + '...', state });
    
    const storedState = sessionStorage.getItem('oauth_state');
    const codeVerifier = sessionStorage.getItem('code_verifier');

    if (!storedState || !codeVerifier) {
      throw new Error('OAuth state not found');
    }

    // Extract workflow state ID if present
    const [oauthState, workflowStateId] = state.split(':');

    if (oauthState !== storedState) {
      throw new Error('OAuth state mismatch');
    }

    console.log('Exchanging code for tokens...');
    // Exchange code for tokens
    const connection = await this.exchangeCodeForTokens(code, codeVerifier);
    console.log('Token exchange successful, connection:', { 
      hasAccessToken: !!connection.accessToken, 
      user: connection.user 
    });
    
    // Store the connection
    this.connection = connection;
    this.saveToStorage();
    console.log('Connection saved to localStorage');
    
    // Update the OAuth state
    this.updateState({
      isConnected: true,
      accessToken: connection.accessToken,
      user: connection.user,
      isLoading: false,
    });
    console.log('OAuth state updated');
    
    // Clear any previous errors
    if (this.currentState.error) {
      delete this.currentState.error;
      this.notifyListeners();
    }

    // Clear PKCE parameters
    sessionStorage.removeItem('oauth_state');
    sessionStorage.removeItem('code_verifier');

    // Load user data in background
    this.loadUserData().catch(console.error);

    // Restore workflow state if present
    let workflowState: WorkflowState | null = null;
    if (workflowStateId) {
      const stateManager = WorkflowStateManager.getInstance();
      workflowState = stateManager.restoreState(workflowStateId);
      if (workflowState) {
        stateManager.clearState(workflowStateId);
      }
    }

    console.log('OAuth callback complete, returning workflow state:', workflowState);
    return { workflowState };
  }

  /**
   * Disconnect from Supabase management
   */
  public disconnect(): void {
    // Clear storage
    sessionStorage.removeItem('oauth_state');
    sessionStorage.removeItem('code_verifier');
    localStorage.removeItem(SupabaseOAuth.STORAGE_KEY);

    // Reset state
    this.connection = null;
    this.currentState = {
      isConnected: false,
      isLoading: false,
    };

    // Notify listeners
    this.notifyListeners();
  }

  /**
   * Get management API client
   */
  getManagementClient() {
    if (!this.connection?.accessToken) {
      throw new Error('Not connected to Supabase');
    }
    
    return createSupabaseManagement(this.connection.accessToken);
  }

  /**
   * Load user organizations and projects
   */
  async loadUserData(): Promise<void> {
    if (!this.connection?.accessToken) {
      throw new Error('Not connected');
    }

    try {
      this.updateState({ isLoading: true });

      const management = this.getManagementClient();
      
      // Load organizations
      const organizations = await management.getOrganizations();
      
      // Load projects (for all organizations)
      const projects = await management.getProjects();

      this.updateState({
        organizations,
        projects,
        isLoading: false,
      });
    } catch (error) {
      this.updateState({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to load user data',
      });
    }
  }

  /**
   * Select organization
   */
  selectOrganization(organization: Organization): void {
    this.currentState = {
      ...this.currentState,
      selectedOrganization: organization,
    };
    delete this.currentState.selectedProject;
    this.listeners.forEach(listener => listener(this.currentState));
  }

  /**
   * Select project
   */
  selectProject(project: SupabaseProject): void {
    this.updateState({
      selectedProject: project,
    });
  }

  /**
   * Refresh access token if needed
   */
  async refreshTokenIfNeeded(): Promise<void> {
    if (!this.connection?.refreshToken) {
      return;
    }

    // Check if token is expiring soon (within 5 minutes)
    const expiresAt = this.connection.expiresAt;
    if (!expiresAt || Date.now() < expiresAt - 5 * 60 * 1000) {
      return;
    }

    try {
      const newConnection = await this.refreshAccessToken(this.connection.refreshToken);
      this.connection = {
        ...this.connection,
        ...newConnection,
      };
      this.saveToStorage();

      if (newConnection.accessToken) {
        this.updateState({
          accessToken: newConnection.accessToken,
        });
      }
    } catch (error) {
      console.error('Failed to refresh token:', error);
      // Force re-authentication
      await this.disconnect();
    }
  }

  /**
   * Exchange authorization code for tokens
   */
  private async exchangeCodeForTokens(
    code: string, 
    codeVerifier: string
  ): Promise<OAuthConnection> {
    if (!SupabaseOAuth.CLIENT_ID) {
      throw new Error('Supabase OAuth client ID not configured');
    }

    const response = await fetch('/api/auth/supabase/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        code,
        code_verifier: codeVerifier,
        redirect_uri: SupabaseOAuth.REDIRECT_URI,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Token exchange failed: ${error}`);
    }

    const data = await response.json();

    const connection = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || undefined,
      expiresAt: data.expires_in ? Date.now() + (data.expires_in * 1000) : null,
      scope: data.scope ? data.scope.split(' ') : ['all'],
      // Supabase Management API doesn't provide user info
      user: {
        id: '',
        email: '',
      },
    };
    
    return connection;
  }

  /**
   * Refresh access token
   */
  private async refreshAccessToken(refreshToken: string): Promise<Partial<OAuthConnection>> {
    const response = await fetch('/api/auth/supabase/refresh', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        refresh_token: refreshToken,
      }),
    });

    if (!response.ok) {
      throw new Error('Token refresh failed');
    }

    const data = await response.json();
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || undefined,
      expiresAt: data.expires_in ? Date.now() + (data.expires_in * 1000) : null,
    };
  }

  /**
   * Update state and notify listeners
   */
  private updateState(updates: Partial<OAuthState>): void {
    this.currentState = { ...this.currentState, ...updates };
    this.listeners.forEach(listener => listener(this.currentState));
  }

  /**
   * Load connection from localStorage
   */
  private loadFromStorage(): void {
    if (typeof window === 'undefined') return;

    try {
      const stored = localStorage.getItem(SupabaseOAuth.STORAGE_KEY);
      if (stored) {
        this.connection = JSON.parse(stored);
        
        if (this.connection) {
          this.updateState({
            isConnected: true,
            accessToken: this.connection.accessToken,
            user: this.connection.user,
          });

          // Load user data in background
          this.loadUserData().catch(console.error);
        }
      }
    } catch (error) {
      console.error('Failed to load OAuth state:', error);
      this.clearStorage();
    }
  }

  /**
   * Save connection to localStorage
   */
  private saveToStorage(): void {
    if (typeof window === 'undefined' || !this.connection) return;

    try {
      localStorage.setItem(SupabaseOAuth.STORAGE_KEY, JSON.stringify(this.connection));
    } catch (error) {
      console.error('Failed to save OAuth state:', error);
    }
  }

  /**
   * Clear stored connection
   */
  private clearStorage(): void {
    if (typeof window === 'undefined') return;

    try {
      localStorage.removeItem(SupabaseOAuth.STORAGE_KEY);
    } catch (error) {
      console.error('Failed to clear OAuth state:', error);
    }
  }

  /**
   * Generate random state parameter
   */
  private generateState(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Generate PKCE code verifier
   */
  private generateCodeVerifier(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return btoa(String.fromCharCode(...array))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  /**
   * Generate PKCE code challenge
   */
  private async generateCodeChallenge(verifier: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const digest = await crypto.subtle.digest('SHA-256', data);
    
    return btoa(String.fromCharCode(...new Uint8Array(digest)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  /**
   * Notify listeners of state changes
   */
  private notifyListeners(): void {
    this.listeners.forEach(listener => listener(this.currentState));
  }
}

// Singleton instance
let oauthInstance: SupabaseOAuth | null = null;

/**
 * Get OAuth manager instance
 */
export function getSupabaseOAuth(): SupabaseOAuth {
  if (!oauthInstance) {
    oauthInstance = new SupabaseOAuth();
  }
  return oauthInstance;
}

/**
 * Hook for OAuth state (React-like interface)
 */
export function useSupabaseOAuth() {
  const oauth = getSupabaseOAuth();
  
  return {
    ...oauth.getState(),
    startOAuth: (options?: { scopes?: string[] } | Omit<WorkflowState, "id" | "timestamp">) => oauth.startOAuth(options),
    disconnect: () => oauth.disconnect(),
    loadUserData: () => oauth.loadUserData(),
    selectOrganization: (org: Organization) => oauth.selectOrganization(org),
    selectProject: (project: SupabaseProject) => oauth.selectProject(project),
    getManagementClient: () => oauth.getManagementClient(),
    refreshTokenIfNeeded: () => oauth.refreshTokenIfNeeded(),
  };
}