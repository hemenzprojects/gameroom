# Game Room (Rebus Board + Bible Quiz)

A team game room: colleagues create accounts, form teams with a 5-character invite code, pick a game, and play rounds together in real time with a corner team chat.

- **Rebus Board.** Type the word or phrase a sticky note hides. Levels go from Beginner to Legend.
- **Bible Quiz.** Each question is an illustrated Bible scene with four answers. Levels go from Seeker to Legend, and the Bible reference is shown after each answer.

The first teammate to get each answer scores the points, and finished rounds go on each game's leaderboard.

- **Live:** https://rebus-board.fly.dev (the Fly app is called `rebus-board`)
- **Code:** https://github.com/hemenzprojects/gameroom

- **Server:** Node.js, Express, Socket.IO
- **Storage:** SQLite (`better-sqlite3`), one file at `$DATA_DIR/rebus.db`
- **Client:** plain HTML/CSS/JS in `public/` with no build step

## Run locally

```bash
npm install
npm start            # http://localhost:4100
# or: npm run dev    # restarts on file changes
```

Set `PORT` to change the port. The data goes in `./data/` unless you set `DATA_DIR`.

Colleagues on the same network can join at `http://<your-computer's-IP>:4100`. On a Mac, `ipconfig getifaddr en0` shows the IP.

## Deploy to Fly.io

```bash
fly auth login
fly launch --no-deploy --copy-config      # pick an app name and region; keep the existing fly.toml
fly volumes create rebus_data --size 1 --region <same region as primary_region>
fly deploy
fly open
```

- SQLite needs a volume, so run **one machine** only. If `fly launch` or `fly deploy` creates two, run `fly scale count 1`.
- The machine stops when nobody is connected and starts again on the next visit, which takes a couple of seconds.
- Back up the database with `fly ssh sftp get /data/rebus.db`.

## Project layout

| Path | What it is |
|------|------------|
| `src/server.js` | HTTP API (accounts, teams, leaderboard) and the live game over Socket.IO |
| `src/game.js` | Game rules: rounds, scoring, hints, and what each player is allowed to see |
| `src/puzzles.js` | Rebus puzzle bank: drawings, answers and hints. Answers stay on the server |
| `src/bible.js` | Bible Quiz bank: scene recipes, questions, answers, clues and references |
| `src/db.js` | SQLite schema |
| `public/` | The web page and styles. `note.js` draws sticky notes, `scene.js` paints Bible scenes, `chat.js` is the team chat |

## Adding puzzles

Add an entry to `EASY`, `MEDIUM` or `HARD` in `src/puzzles.js`. Each note is drawn on a 300×300 canvas:

```js
{ e: [T('MAN', 150, 112, 62), T('BOARD', 150, 200, 62)],   // T(text, x, y, size, {r: rotation, deco: 'u'|'strike'})
  a: ['man overboard'],                                    // accepted answers (case, spaces and small typos are ignored)
  h: 'Shouted on a ship when someone falls in.' }          // first hint
```

You can also use `L(x1,y1,x2,y2)` for a line, `R(x,y,w,h)` for a box, `P('M.. L..')` for a freehand path, and `eq('🐝','lieve')` for an "A + B" note.

## Adding Bible questions

Add an entry to a level in `src/bible.js`:

```js
{ s: 'sea', fx: ['waves', 'clouds'],                       // backdrop + effects (see the list at the top of the file)
  e: [E('🐋', 165, 200, 116), E('🧔', 78, 168, 38)],        // emoji placed on a 300×300 card
  q: 'Which prophet was swallowed by a great fish?',
  a: 'Jonah', c: ['Elijah', 'Daniel', 'Peter'],            // the answer + three wrong options
  h: 'He ran from God’s call to go to Nineveh.', ref: 'Jonah 1–2' }
```

## Admins

Admins get an **Admin** button that opens a dashboard. It shows totals for people, teams, who's online, weekly activity and rounds played, plus a list of every person and team. From it admins can **suspend** or **restore** people and **make or remove admins**.

- A suspended person is logged out straight away, can't log in, and is hidden from their team. Their scores and chat messages stay.
- Admins can't suspend themselves or remove their own admin access.

There are two ways to make the first admin:

```bash
# 1. Setting, by account name (applied on start-up and when that name signs up)
ADMIN_NAMES="<account name>,<another>" npm start
fly secrets set ADMIN_NAMES="<account name>" -a rebus-board

# 2. Command, for an account that already exists
npm run make-admin -- "<account name>"                  # add --remove to take it away
fly ssh console -a rebus-board -C 'node /app/src/make-admin.js "<account name>"'
```
