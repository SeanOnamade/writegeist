import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

const dbFile = `${process.cwd()}/writegeist.db`;
let database = new Database(dbFile);
export let db = drizzle(database);

// Callback to notify when database is reopened
let onDatabaseReopenCallback: (() => void) | null = null;

export const setDatabaseReopenCallback = (callback: () => void) => {
  onDatabaseReopenCallback = callback;
};

// Database connection management functions
export const closeDatabaseConnection = () => {
  try {
    if (database && database.open) {
      database.close();
      console.log('✅ Database connection closed');
      return true;
    }
  } catch (error) {
    console.error('❌ Error closing database:', error);
    return false;
  }
  return false;
};

export const reopenDatabaseConnection = () => {
  try {
    database = new Database(dbFile);
    db = drizzle(database);
    console.log('✅ Database connection reopened');
    
    // Notify that database has been reopened
    if (onDatabaseReopenCallback) {
      onDatabaseReopenCallback();
    }
    
    return true;
  } catch (error) {
    console.error('❌ Error reopening database:', error);
    return false;
  }
};

export const projects = sqliteTable('projects', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  createdAt: text('created_at').$defaultFn(() => new Date().toISOString()),
});

export const chapters = sqliteTable('chapters', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  text: text('text').notNull(),
  characters: text('characters').notNull(), // JSON array string
  locations: text('locations').notNull(), // JSON array string
  pov: text('pov').notNull(), // JSON array string
  createdAt: text('created_at').$defaultFn(() => new Date().toISOString()),
});

export const projectPages = sqliteTable('project_pages', {
  id: integer('id').primaryKey(),
  markdown: text('markdown').notNull(),
});

// Create tables if they don't exist
database.exec(`
  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );
  
  CREATE TABLE IF NOT EXISTS chapters (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    text TEXT NOT NULL,
    characters TEXT NOT NULL,
    locations TEXT NOT NULL,
    pov TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS project_pages (
    id INTEGER PRIMARY KEY,
    markdown TEXT NOT NULL
  );
`); 