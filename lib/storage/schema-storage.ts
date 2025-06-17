import { DatabaseSchema } from "@/lib/db/database-schema";

const SCHEMA_STORAGE_KEY = "userSchema";

export class SchemaStorage {
  static store(schema: DatabaseSchema): void {
    if (typeof window !== "undefined") {
      localStorage.setItem(SCHEMA_STORAGE_KEY, JSON.stringify(schema));
    }
  }

  static retrieve(): DatabaseSchema | null {
    if (typeof window !== "undefined") {
      const storedSchema = localStorage.getItem(SCHEMA_STORAGE_KEY);
      if (storedSchema) {
        try {
          return JSON.parse(storedSchema) as DatabaseSchema;
        } catch (error) {
          console.error("Error parsing stored schema:", error);
          return null;
        }
      }
    }
    return null;
  }

  static clear(): void {
    if (typeof window !== "undefined") {
      localStorage.removeItem(SCHEMA_STORAGE_KEY);
    }
  }
}
