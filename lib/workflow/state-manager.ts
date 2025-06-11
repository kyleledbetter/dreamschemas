import { DatabaseSchema } from '@/types/schema.types';
import { v4 as uuidv4 } from 'uuid';

export interface WorkflowData {
  files?: {
    name: string;
    content: string;
    type: string;
  }[];
  schema?: DatabaseSchema;
  options?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface WorkflowState {
  id: string;
  step: string;
  data: WorkflowData;
  timestamp: number;
  returnPath: string;
}

const STORAGE_KEY = 'dreamschema_workflow_state';
const STATE_EXPIRY = 30 * 60 * 1000; // 30 minutes

export class WorkflowStateManager {
  private static instance: WorkflowStateManager;

  private constructor() {}

  static getInstance(): WorkflowStateManager {
    if (!WorkflowStateManager.instance) {
      WorkflowStateManager.instance = new WorkflowStateManager();
    }
    return WorkflowStateManager.instance;
  }

  /**
   * Save workflow state before OAuth redirect
   */
  saveState(state: Omit<WorkflowState, 'id' | 'timestamp'>): string {
    const id = uuidv4();
    const fullState: WorkflowState = {
      ...state,
      id,
      timestamp: Date.now(),
    };

    // Save to localStorage
    const existingStates = this.getAllStates();
    existingStates[id] = fullState;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(existingStates));

    return id;
  }

  /**
   * Restore workflow state after OAuth redirect
   */
  restoreState(id: string): WorkflowState | null {
    const states = this.getAllStates();
    const state = states[id];

    if (!state) {
      return null;
    }

    // Check if state has expired
    if (Date.now() - state.timestamp > STATE_EXPIRY) {
      this.clearState(id);
      return null;
    }

    return state;
  }

  /**
   * Clear a specific workflow state
   */
  clearState(id: string): void {
    const states = this.getAllStates();
    delete states[id];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(states));
  }

  /**
   * Clear all expired states
   */
  clearExpiredStates(): void {
    const states = this.getAllStates();
    const now = Date.now();

    Object.entries(states).forEach(([id, state]) => {
      if (now - state.timestamp > STATE_EXPIRY) {
        delete states[id];
      }
    });

    localStorage.setItem(STORAGE_KEY, JSON.stringify(states));
  }

  /**
   * Get all stored states
   */
  private getAllStates(): Record<string, WorkflowState> {
    try {
      const statesJson = localStorage.getItem(STORAGE_KEY);
      return statesJson ? JSON.parse(statesJson) : {};
    } catch {
      return {};
    }
  }
} 