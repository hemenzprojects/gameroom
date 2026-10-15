'use strict';
// Make an existing account an admin (or take it away):
//   node src/make-admin.js "Ama Mensah"
//   node src/make-admin.js "Ama Mensah" --remove
const db = require('./db');

const name = process.argv[2];
const remove = process.argv.includes('--remove');
if (!name) { console.error('Usage: node src/make-admin.js "<account name>" [--remove]'); process.exit(1); }
const u = db.prepare('SELECT id, name, role FROM users WHERE name = ?').get(name);
if (!u) { console.error(`No account called "${name}". Names are not case-sensitive; check the spelling.`); process.exit(1); }
db.prepare('UPDATE users SET role = ? WHERE id = ?').run(remove ? 'player' : 'admin', u.id);
console.log(`${u.name} is now ${remove ? 'a player' : 'an admin'}.`);
