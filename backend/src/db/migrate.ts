import fs from 'fs';
import path from 'path';
import { db } from './client';

async function migrate() {
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
  try {
    await db.query(schema);
    console.log('Database migration completed successfully.');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    await db.end();
  }
}

migrate();
