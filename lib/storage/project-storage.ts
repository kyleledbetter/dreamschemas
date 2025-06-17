/**
 * Project Data Storage Utilities
 * Manages localStorage persistence for project data across the application
 */

interface ProjectData {
  projectId: string;
  projectName: string;
  dbUrl: string;
}

const STORAGE_KEY = 'dreamschema-project-data';

export class ProjectStorage {
  /**
   * Store project data in localStorage
   */
  static store(projectData: ProjectData): boolean {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(projectData));
      return true;
    } catch (error) {
      console.warn('Failed to store project data in localStorage:', error);
      return false;
    }
  }

  /**
   * Retrieve project data from localStorage
   */
  static retrieve(): ProjectData | null {
    try {
      const storedData = localStorage.getItem(STORAGE_KEY);
      if (storedData) {
        return JSON.parse(storedData);
      }
    } catch (error) {
      console.warn('Failed to retrieve project data from localStorage:', error);
    }
    return null;
  }

  /**
   * Clear project data from localStorage
   */
  static clear(): boolean {
    try {
      localStorage.removeItem(STORAGE_KEY);
      return true;
    } catch (error) {
      console.warn('Failed to clear project data from localStorage:', error);
      return false;
    }
  }

  /**
   * Get project ID with fallback to localStorage
   */
  static getProjectId(primarySource?: string): string | null {
    // Try primary source first (but skip if it's an empty string)
    if (primarySource && primarySource.trim() !== "") {
      return primarySource;
    }

    // Fallback to localStorage
    const storedData = ProjectStorage.retrieve();
    const storedProjectId = storedData?.projectId;
    
    // Return stored project ID only if it's not empty
    return (storedProjectId && storedProjectId.trim() !== "") ? storedProjectId : null;
  }

  /**
   * Check if project data exists in localStorage
   */
  static hasProjectData(): boolean {
    return ProjectStorage.retrieve() !== null;
  }
}

export type { ProjectData };