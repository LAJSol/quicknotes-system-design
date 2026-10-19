# QuickNotes Data Model

QuickNotes stores its data in a **relational (SQL) database**. There are four tables: `users`, `notes`, `tags` and `note_tags`.

## Entities

### `users`

| Column          | Type    | Key             | Notes                                             |
| --------------- | ------- | --------------- | ------------------------------------------------- |
| `id`            | INTEGER | **Primary key** | Assigned by the database                          |
| `name`          | TEXT    |                 | Required                                          |
| `email`         | TEXT    |                 | Required and unique                               |
| `password_hash` | TEXT    |                 | Required. A one-way hash, never the real password |
| `created_at`    | TEXT    |                 | Filled in automatically                           |

### `notes`

| Column       | Type    | Key                           | Notes                                                     |
| ------------ | ------- | ----------------------------- | --------------------------------------------------------- |
| `id`         | INTEGER | **Primary key**               | Assigned by the database                                  |
| `user_id`    | INTEGER | **Foreign key** to `users.id` | The note's owner                                          |
| `text`       | TEXT    |                               | Required, at most 200 characters                          |
| `category`   | TEXT    |                               | One of `personal`, `work` or `study` (default `personal`) |
| `created_at` | TEXT    |                               | Filled in automatically                                   |

### `tags`

| Column | Type    | Key             | Notes                    |
| ------ | ------- | --------------- | ------------------------ |
| `id`   | INTEGER | **Primary key** | Assigned by the database |
| `name` | TEXT    |                 | Required and unique      |

### `note_tags`

| Column    | Type    | Key                                                     | Notes |
| --------- | ------- | ------------------------------------------------------- | ----- |
| `note_id` | INTEGER | **Foreign key** to `notes.id` (part of the primary key) |       |
| `tag_id`  | INTEGER | **Foreign key** to `tags.id` (part of the primary key)  |       |

The primary key of `note_tags` is the **pair** `(note_id, tag_id)`.

## Relationships

- **One user has many notes (one-to-many).** One row in `users` matches many rows in `notes`. The "many" side holds the foreign key, so `notes.user_id` points to `users.id`.
- **Notes and tags are many-to-many.** A note can have many tags ("exams" and "urgent"), and a tag can be on many notes. A column can hold only one value, so we use a **join table**, `note_tags`, with one row for each (note, tag) pair. Because the primary key is the pair, the same tag cannot be attached to the same note twice.
- The join table connects two **one-to-many** links: one note has many `note_tags` rows, and one tag has many `note_tags` rows.

```text
users 1 ────< notes >────< note_tags >──── tags
       one-to-many     many-to-many (through the join table)
```

## `CREATE TABLE` statements

```sql
PRAGMA foreign_keys = ON;  -- SQLite only enforces foreign keys after this line

CREATE TABLE users (
  id            INTEGER PRIMARY KEY,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at    TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE notes (
  id         INTEGER PRIMARY KEY,
  user_id    INTEGER NOT NULL,
  text       TEXT NOT NULL CHECK (length(text) <= 200),
  category   TEXT NOT NULL DEFAULT 'personal'
             CHECK (category IN ('personal', 'work', 'study')),
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE tags (
  id   INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE note_tags (
  note_id INTEGER NOT NULL,
  tag_id  INTEGER NOT NULL,
  PRIMARY KEY (note_id, tag_id),
  FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id)  REFERENCES tags(id)  ON DELETE CASCADE
);
```

`ON DELETE CASCADE` means that deleting a user deletes their notes, and deleting a note removes its tag links, so no orphan rows are left.

## Example queries

Each API endpoint becomes one SQL query on the server. The `?` marks are placeholders that the server fills in safely, which protects against SQL injection.

**1. `GET /notes`: the logged-in user's notes, newest first**

```sql
SELECT id, text, category, created_at
FROM notes
WHERE user_id = ?
ORDER BY created_at DESC;
```

**2. Notes tagged "urgent" (a `JOIN` across the join table)**

```sql
SELECT notes.text, notes.category
FROM notes
JOIN note_tags ON note_tags.note_id = notes.id
JOIN tags ON tags.id = note_tags.tag_id
WHERE tags.name = 'urgent'
  AND notes.user_id = ?;
```

**3. How many notes each user has (`LEFT JOIN` keeps users with zero notes)**

```sql
SELECT users.name, COUNT(notes.id) AS note_count
FROM users
LEFT JOIN notes ON notes.user_id = users.id
GROUP BY users.id;
```

**4. `DELETE /notes/42`: only the owner can delete**

```sql
DELETE FROM notes
WHERE id = 42 AND user_id = ?;
```

## Index

```sql
CREATE INDEX idx_notes_user_id ON notes(user_id);
```

**Reason:** almost every request asks for "the notes of one user" (`WHERE user_id = ?`). Without an index, the database would check every row in `notes`, which becomes slow with millions of notes. With the index, it jumps straight to that user's notes. The trade-off is that writes become slightly slower and the index uses extra space, which is worth it because QuickNotes reads far more often than it writes. Primary keys are indexed automatically.

## SQL or NoSQL?

I chose **SQL**. The QuickNotes data is clearly structured: every note has the same fields, and the relationships matter (a user owns notes, and notes have tags in a many-to-many link). A relational database handles this with foreign keys and `JOIN`s, and it enforces the rules itself: unique emails, a 200-character limit, valid categories, and no tag attached twice. That keeps the data correct even if the application code has a bug. A document database could store each user's notes inside one document, but tags would be repeated across many documents and could become inconsistent, and queries such as "all notes tagged urgent" would be harder. NoSQL would only become attractive if notes later turned into very flexible content, such as drawings, checklists and images, or if the system needed to spread across many servers. At 1 million users, a single SQL primary with read replicas is enough.
