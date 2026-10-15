'use strict';
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const dir = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
fs.mkdirSync(dir, { recursive: true });

const db = new Database(path.join(dir, 'rebus.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS teams (
    id         INTEGER PRIMARY KEY,
    name       TEXT NOT NULL,
    code       TEXT NOT NULL UNIQUE,
    game       TEXT,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS users (
    id         INTEGER PRIMARY KEY,
    name       TEXT NOT NULL UNIQUE COLLATE NOCASE,
    pass       TEXT NOT NULL,
    team_id    INTEGER REFERENCES teams(id) ON DELETE SET NULL,
    points     INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token      TEXT PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS scores (
    id        INTEGER PRIMARY KEY,
    team_id   INTEGER,
    team_name TEXT NOT NULL,
    lv        INTEGER NOT NULL,
    score     INTEGER NOT NULL,
    correct   INTEGER NOT NULL,
    total     INTEGER NOT NULL,
    at        INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS scores_lv ON scores (lv, score DESC);
  CREATE TABLE IF NOT EXISTS chat (
    id      INTEGER PRIMARY KEY,
    team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    user_id INTEGER,
    name    TEXT,
    kind    TEXT NOT NULL DEFAULT 'msg',  -- msg: typed by a player; event: posted by the game
    text    TEXT NOT NULL,
    at      INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS chat_team ON chat (team_id, id DESC);
`);

// Columns added after the first release.
const chatCols = db.prepare('PRAGMA table_info(chat)').all().map(c => c.name);
if (!chatCols.includes('reply_to')) db.exec('ALTER TABLE chat ADD COLUMN reply_to INTEGER');
const userCols = db.prepare('PRAGMA table_info(users)').all().map(c => c.name);
if (!userCols.includes('role')) db.exec("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'player'"); // player | admin
if (!userCols.includes('suspended_at')) db.exec('ALTER TABLE users ADD COLUMN suspended_at INTEGER');
if (!userCols.includes('suspended_reason')) db.exec('ALTER TABLE users ADD COLUMN suspended_reason TEXT');
if (!userCols.includes('last_seen')) db.exec('ALTER TABLE users ADD COLUMN last_seen INTEGER');
const teamCols = db.prepare('PRAGMA table_info(teams)').all().map(c => c.name);
if (!teamCols.includes('seen')) db.exec("ALTER TABLE teams ADD COLUMN seen TEXT NOT NULL DEFAULT '{}'"); // {"bible:0": {questionId: lastShownAt}}
const scoreCols = db.prepare('PRAGMA table_info(scores)').all().map(c => c.name);
if (!scoreCols.includes('game')) db.exec("ALTER TABLE scores ADD COLUMN game TEXT NOT NULL DEFAULT 'rebus'");
if (!chatCols.includes('reactions')) db.exec("ALTER TABLE chat ADD COLUMN reactions TEXT NOT NULL DEFAULT '{}'");


module.exports = db;
