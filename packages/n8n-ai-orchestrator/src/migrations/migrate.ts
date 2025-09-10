#!/usr/bin/env node
/**
 * Migration CLI for n8n-ai
 * Usage: tsx src/migrations/migrate.ts [command] [options]
 */

import { migrationSystem } from './migration-system.js';

async function main() {
  const command = process.argv[2];
  const targetVersion = process.argv[3];

  try {
    switch (command) {
      case 'up':
      case 'migrate':
        console.log('🚀 Running migrations...');
        const results = await migrationSystem.migrate(targetVersion);
        
        if (results.length === 0) {
          console.log('✅ No migrations to run');
        } else {
          const successCount = results.filter(r => r.success).length;
          const failCount = results.filter(r => !r.success).length;
          
          console.log(`\n📊 Migration Summary:`);
          console.log(`✅ Successful: ${successCount}`);
          console.log(`❌ Failed: ${failCount}`);
          
          if (failCount > 0) {
            process.exit(1);
          }
        }
        break;

      case 'down':
      case 'rollback':
        console.log('🔄 Rolling back migrations...');
        const rollbackResults = await migrationSystem.rollback(targetVersion);
        
        if (rollbackResults.length === 0) {
          console.log('✅ No migrations to rollback');
        } else {
          const successCount = rollbackResults.filter(r => r.success).length;
          const failCount = rollbackResults.filter(r => !r.success).length;
          
          console.log(`\n📊 Rollback Summary:`);
          console.log(`✅ Successful: ${successCount}`);
          console.log(`❌ Failed: ${failCount}`);
          
          if (failCount > 0) {
            process.exit(1);
          }
        }
        break;

      case 'status':
        console.log('📊 Migration Status:');
        const status = await migrationSystem.getStatus();
        
        console.log(`Current Version: ${status.currentVersion}`);
        console.log(`Latest Version: ${status.latestVersion}`);
        console.log(`Applied Migrations: ${status.appliedMigrations.length}`);
        console.log(`Pending Migrations: ${status.pendingMigrations.length}`);
        
        if (status.pendingMigrations.length > 0) {
          console.log('\nPending Migrations:');
          status.pendingMigrations.forEach(version => {
            console.log(`  - ${version}`);
          });
        }
        break;

      case 'help':
      case '--help':
      case '-h':
        console.log(`
n8n-ai Migration CLI

Usage:
  tsx src/migrations/migrate.ts <command> [options]

Commands:
  up, migrate [version]    Run migrations up to specified version
  down, rollback [version] Rollback migrations to specified version
  status                   Show current migration status
  help                     Show this help message

Examples:
  tsx src/migrations/migrate.ts up
  tsx src/migrations/migrate.ts up 0.1.1
  tsx src/migrations/migrate.ts down
  tsx src/migrations/migrate.ts status
        `);
        break;

      default:
        console.error(`❌ Unknown command: ${command}`);
        console.log('Run "tsx src/migrations/migrate.ts help" for usage information');
        process.exit(1);
    }
  } catch (error) {
    console.error('❌ Migration failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();