/**
 * AlertMind — Database Configuration
 * Re-exports Prisma client for convenience; adds database health utilities.
 */

export { getPrismaClient, connectDatabase, disconnectDatabase } from '../bootstrap/startup.js';
