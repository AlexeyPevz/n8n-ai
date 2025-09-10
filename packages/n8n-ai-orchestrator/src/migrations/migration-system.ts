/**
 * Migration System for n8n-ai
 * Handles database schema migrations and data transformations
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

export interface Migration {
  version: string;
  name: string;
  description: string;
  up: () => Promise<void>;
  down: () => Promise<void>;
  dependencies?: string[];
}

export interface MigrationResult {
  success: boolean;
  version: string;
  name: string;
  duration: number;
  error?: string;
}

export class MigrationSystem {
  private migrations: Map<string, Migration> = new Map();
  private migrationsPath: string;
  private statePath: string;

  constructor(migrationsPath: string = './migrations') {
    this.migrationsPath = migrationsPath;
    this.statePath = join(migrationsPath, '.migration-state.json');
    this.loadMigrations();
  }

  private loadMigrations(): void {
    // In a real implementation, this would load from filesystem
    // For now, we'll define migrations inline
    this.registerMigration({
      version: '0.1.0',
      name: 'initial_schema',
      description: 'Create initial database schema',
      up: async () => {
        // Create tables, indexes, etc.
        console.log('Creating initial schema...');
      },
      down: async () => {
        // Drop tables, indexes, etc.
        console.log('Dropping initial schema...');
      }
    });

    this.registerMigration({
      version: '0.1.1',
      name: 'add_audit_tables',
      description: 'Add audit logging tables',
      up: async () => {
        console.log('Adding audit tables...');
      },
      down: async () => {
        console.log('Removing audit tables...');
      },
      dependencies: ['0.1.0']
    });

    this.registerMigration({
      version: '0.1.2',
      name: 'add_metrics_tables',
      description: 'Add metrics collection tables',
      up: async () => {
        console.log('Adding metrics tables...');
      },
      down: async () => {
        console.log('Removing metrics tables...');
      },
      dependencies: ['0.1.0']
    });
  }

  registerMigration(migration: Migration): void {
    this.migrations.set(migration.version, migration);
  }

  async migrate(targetVersion?: string): Promise<MigrationResult[]> {
    const currentVersion = await this.getCurrentVersion();
    const target = targetVersion || this.getLatestVersion();
    
    const results: MigrationResult[] = [];
    
    if (currentVersion === target) {
      console.log('Database is already at target version');
      return results;
    }

    const migrationsToRun = this.getMigrationsToRun(currentVersion, target);
    
    for (const migration of migrationsToRun) {
      const start = Date.now();
      try {
        await migration.up();
        await this.setCurrentVersion(migration.version);
        const duration = Date.now() - start;
        
        results.push({
          success: true,
          version: migration.version,
          name: migration.name,
          duration
        });
        
        console.log(`✅ Migration ${migration.version} (${migration.name}) completed in ${duration}ms`);
      } catch (error) {
        const duration = Date.now() - start;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        
        results.push({
          success: false,
          version: migration.version,
          name: migration.name,
          duration,
          error: errorMessage
        });
        
        console.error(`❌ Migration ${migration.version} (${migration.name}) failed: ${errorMessage}`);
        break; // Stop on first failure
      }
    }
    
    return results;
  }

  async rollback(targetVersion?: string): Promise<MigrationResult[]> {
    const currentVersion = await this.getCurrentVersion();
    const target = targetVersion || this.getPreviousVersion(currentVersion);
    
    const results: MigrationResult[] = [];
    
    if (currentVersion === target) {
      console.log('Database is already at target version');
      return results;
    }

    const migrationsToRollback = this.getMigrationsToRollback(currentVersion, target);
    
    for (const migration of migrationsToRollback) {
      const start = Date.now();
      try {
        await migration.down();
        await this.setCurrentVersion(migration.version);
        const duration = Date.now() - start;
        
        results.push({
          success: true,
          version: migration.version,
          name: migration.name,
          duration
        });
        
        console.log(`✅ Rollback ${migration.version} (${migration.name}) completed in ${duration}ms`);
      } catch (error) {
        const duration = Date.now() - start;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        
        results.push({
          success: false,
          version: migration.version,
          name: migration.name,
          duration,
          error: errorMessage
        });
        
        console.error(`❌ Rollback ${migration.version} (${migration.name}) failed: ${errorMessage}`);
        break; // Stop on first failure
      }
    }
    
    return results;
  }

  private getMigrationsToRun(fromVersion: string, toVersion: string): Migration[] {
    const versions = Array.from(this.migrations.keys()).sort(this.compareVersions);
    const fromIndex = versions.indexOf(fromVersion);
    const toIndex = versions.indexOf(toVersion);
    
    if (fromIndex === -1 || toIndex === -1) {
      throw new Error('Invalid version specified');
    }
    
    if (fromIndex >= toIndex) {
      return [];
    }
    
    const migrations: Migration[] = [];
    for (let i = fromIndex + 1; i <= toIndex; i++) {
      const migration = this.migrations.get(versions[i]);
      if (migration) {
        migrations.push(migration);
      }
    }
    
    return migrations;
  }

  private getMigrationsToRollback(fromVersion: string, toVersion: string): Migration[] {
    const versions = Array.from(this.migrations.keys()).sort(this.compareVersions);
    const fromIndex = versions.indexOf(fromVersion);
    const toIndex = versions.indexOf(toVersion);
    
    if (fromIndex === -1 || toIndex === -1) {
      throw new Error('Invalid version specified');
    }
    
    if (fromIndex <= toIndex) {
      return [];
    }
    
    const migrations: Migration[] = [];
    for (let i = fromIndex; i > toIndex; i--) {
      const migration = this.migrations.get(versions[i]);
      if (migration) {
        migrations.push(migration);
      }
    }
    
    return migrations;
  }

  private compareVersions(a: string, b: string): number {
    const aParts = a.split('.').map(Number);
    const bParts = b.split('.').map(Number);
    
    for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
      const aPart = aParts[i] || 0;
      const bPart = bParts[i] || 0;
      
      if (aPart < bPart) return -1;
      if (aPart > bPart) return 1;
    }
    
    return 0;
  }

  private getLatestVersion(): string {
    const versions = Array.from(this.migrations.keys()).sort(this.compareVersions);
    return versions[versions.length - 1] || '0.0.0';
  }

  private getPreviousVersion(version: string): string {
    const versions = Array.from(this.migrations.keys()).sort(this.compareVersions);
    const index = versions.indexOf(version);
    return index > 0 ? versions[index - 1] : '0.0.0';
  }

  private async getCurrentVersion(): Promise<string> {
    if (!existsSync(this.statePath)) {
      return '0.0.0';
    }
    
    try {
      const state = JSON.parse(readFileSync(this.statePath, 'utf-8'));
      return state.version || '0.0.0';
    } catch {
      return '0.0.0';
    }
  }

  private async setCurrentVersion(version: string): Promise<void> {
    if (!existsSync(this.migrationsPath)) {
      mkdirSync(this.migrationsPath, { recursive: true });
    }
    
    const state = {
      version,
      timestamp: new Date().toISOString(),
      migrations: Array.from(this.migrations.keys())
    };
    
    writeFileSync(this.statePath, JSON.stringify(state, null, 2));
  }

  async getStatus(): Promise<{
    currentVersion: string;
    latestVersion: string;
    pendingMigrations: string[];
    appliedMigrations: string[];
  }> {
    const currentVersion = await this.getCurrentVersion();
    const latestVersion = this.getLatestVersion();
    const allVersions = Array.from(this.migrations.keys()).sort(this.compareVersions);
    const currentIndex = allVersions.indexOf(currentVersion);
    
    const appliedMigrations = allVersions.slice(0, currentIndex + 1);
    const pendingMigrations = allVersions.slice(currentIndex + 1);
    
    return {
      currentVersion,
      latestVersion,
      pendingMigrations,
      appliedMigrations
    };
  }
}

// Global migration system instance
export const migrationSystem = new MigrationSystem();