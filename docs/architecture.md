# QuickNotes Architecture

QuickNotes is moving from a browser-only app to an online service used by **1 million people**. This document describes the system that will support that.

## 1. Requirements

### Functional requirements (what the system must do)

- Users can register and log in.
- Users can create, view, update and delete their own notes.
- Each note has a category (personal, work or study) and can have tags.
- Users can search and filter their notes.
- Users can only see and change **their own** notes.
- Notes are available from any device.

### Non-functional requirements (how well it must do it)

- **Speed:** loading the notes list takes under 200 ms for most requests.
- **Availability:** 99.9% uptime, so no single machine can take the whole system down.
- **Scalability:** handle 1 million users now, and grow by adding servers.
- **Durability:** notes are never lost, which means regular backups and replicated data.
- **Security:** HTTPS only, hashed passwords, token-based login and rate limiting.
- **Correctness:** note data follows the rules (text length, valid category) whoever makes the change.

## 2. Load estimate for 1 million users

**Assumptions**

- 1,000,000 registered users, and **20%** use the app on a given day: **200,000 daily active users (DAU)**
- Each active user creates **5 notes** per day and loads their notes **20 times** per day
- An average note, including its extra fields, is about **500 bytes**
- One day is about 100,000 seconds (rounded), and peak traffic is about **5×** the average

**Calculation**

| What                   | Working                                             | Result                                            |
| ---------------------- | --------------------------------------------------- | ------------------------------------------------- |
| **Writes** (new notes) | 200,000 × 5 = 1,000,000 per day, ÷ 100,000          | **about 10 writes per second** (about 50 at peak) |
| **Reads** (load notes) | 200,000 × 20 = 4,000,000 per day, ÷ 100,000         | **about 40 reads per second** (about 200 at peak) |
| **Storage per year**   | 1,000,000 notes × 500 bytes = 500 MB per day, × 365 | **about 180 GB per year**                         |

**What this tells us**

- The system is **read-heavy** (4 times more reads than writes), so caching reads will help a lot.
- About 200 requests per second at peak is manageable for a few ordinary servers.
- 180 GB per year fits comfortably in one well-configured database, so we do **not** need sharding. The design does not have to be huge, because over-engineering is also a mistake.

## 3. Architecture diagram

```text
Client (browser / mobile app)
   │
   ├─(1) DNS lookup ────────────────────────> DNS
   │
   ├─(2) HTML, CSS, JavaScript ─────────────> CDN ──(cache miss)──> Origin
   │
   └─(3) API calls (HTTPS, JSON) ───────────> Load balancer
                                                   │
                                ┌──────────────────┴──────────────────┐
                                v                                     v
                           ┌─────────┐                           ┌─────────┐
                           │  App 1  │                           │  App 2  │   (stateless, identical)
                           └────┬────┘                           └────┬────┘
                                └───────────────┬─────────────────────┘
                   ┌────────────────────────────┼──────────────────────────┐
                   v                            v                          v
          ┌─────────────────┐        ┌─────────────────────┐      ┌────────────────┐
          │  Cache (Redis)  │        │ Primary database    │      │     Queue      │
          │  notes lists    │        │ (all writes)        │      │ (background    │
          └─────────────────┘        └──────────┬──────────┘      │  jobs)         │
                                                │ copies          └───────┬────────┘
                                                v                         │ jobs
                                     ┌─────────────────────┐              v
                                     │ Read replica        │        ┌────────────┐
                                     │ (reads)             │        │   Worker   │ ──> sends emails,
                                     └─────────────────────┘        └────────────┘     creates exports
```

## 4. What each component does

- **Client (browser or mobile app):** shows the notes and sends requests, so the user can read and write notes from any device.
- **DNS:** turns `quicknotes.com` into the addresses of our system, so users can reach us by name.
- **CDN:** serves the static front-end files from servers near the user, which makes pages load faster and keeps that traffic off our own servers.
- **Load balancer:** spreads API requests across the app servers and skips unhealthy ones, so no server is overloaded and one failure does not take the system down.
- **App servers (two or more):** run the API code (login checks, validation, queries), and because they are stateless we can add more whenever traffic grows.
- **Cache (Redis):** keeps each user's recent notes list in memory, so repeated reads take about 1 ms and the database sees only a small fraction of the traffic.
- **Primary database:** the single place that accepts writes, so there is one correct copy of the data.
- **Read replica:** a copy of the primary that answers read requests, so reads do not slow down writes, and it can take over if the primary fails.
- **Queue:** holds slow jobs such as welcome emails and exports, so the API can reply immediately instead of making the user wait.
- **Worker:** takes jobs from the queue and does them in the background, so a burst of jobs only makes the queue longer and does not slow down the app.

## 5. Request flows

### `GET /notes`

1. The client sends `GET /notes` with the token in the `Authorization` header. DNS finds our address and the request reaches the **load balancer**.
2. The load balancer picks the least busy healthy **app server** (about 1 ms).
3. The app server checks the token and works out which user is asking (1 to 2 ms).
4. It asks the **cache** for `notes:user:<id>`.
   - **Cache hit:** the notes come back in about 1 ms, and the server replies `200 OK`.
   - **Cache miss:** the server runs `SELECT ... WHERE user_id = ?` on a **read replica** (about 5 to 20 ms, using the index), stores the result in the cache with a TTL of a few minutes, and replies `200 OK`.
5. The client receives the JSON and draws the notes.

### `POST /notes`

1. The client sends `POST /notes` with the note in the body and the token in the header. The request goes through DNS to the **load balancer**.
2. The load balancer forwards it to any healthy **app server**.
3. The app server checks the token and **validates** the data (text length, valid category). If it is invalid, it replies `400 Bad Request` and stops.
4. It writes the note to the **primary database** (about 5 to 10 ms), because only the primary accepts writes.
5. It **deletes** `notes:user:<id>` from the cache, so the next read fetches fresh data instead of a stale list.
6. It replies `201 Created` with the new note. In the background, the primary copies the new row to the replicas within a few milliseconds.

## 6. Trade-offs

1. **Speed versus freshness.** The cache and the read replicas make reads very fast, but they can show slightly old data (the cache until it is cleared or expires, and replicas for a few milliseconds of replication lag). A note list that is a moment out of date is acceptable for a notes app, and we delete a user's cached list whenever they change a note to keep it fresh. For something like a bank balance this would not be acceptable.
2. **Simplicity versus scalability.** We use one application (a monolith), one primary database and no sharding. This is far simpler to build, test and run than microservices and a sharded database. The cost is a ceiling on how far writes can scale, but at about 50 writes per second at peak, that ceiling is far away.
3. **Cost versus reliability.** Two or more app servers, a read replica and backups cost more than one server, but they are what give us 99.9% availability and protect the notes from being lost.

## 7. Avoiding single points of failure

| Part             | If it fails                 | How we avoid a single point of failure                                                                                             |
| ---------------- | --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| App server       | Requests to it fail         | There are two or more identical, stateless app servers, and the load balancer's health checks stop sending traffic to a failed one |
| Load balancer    | No requests get through     | Run it as a redundant pair (or use a managed cloud load balancer that is already redundant)                                        |
| Primary database | No writes are possible      | The read replica can be promoted to become the new primary (failover), and we take regular backups                                 |
| Cache            | Reads are slower            | The app falls back to the database, so the system keeps working, only more slowly                                                  |
| CDN              | Static files do not load    | A CDN already has servers around the world, so another edge server answers                                                         |
| Queue and worker | Background jobs are delayed | Jobs wait safely in the queue, and we can run more than one worker                                                                 |

Because the app servers are **stateless**, any server can handle any request, so a crashed server loses no user data.
