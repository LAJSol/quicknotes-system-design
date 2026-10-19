<!-- # quicknotes-system-design
The repository for Project 2, dedicated to storing all system design documentation, architecture diagrams, and related specs for the QuickNotes system. -->

# QuickNotes System Design

QuickNotes is moving from a browser-only app to a real online service for 1 million people. This project has two parts: a small **API client** that proves the front end can talk to an API (using the JSONPlaceholder practice API), and **three design documents** that the backend team can build from.

## What is in this project

- **API client** (`index.html`, `api.js`, `style.css`): load notes, create a note and delete a note using `fetch`, with loading, success, error and empty states, input validation and disabled buttons while a request runs
- **API design:** the REST endpoints, JSON examples and error codes for the real QuickNotes API
- **Data model:** the tables, relationships, SQL, an index and the SQL vs NoSQL decision
- **Architecture:** requirements, load estimate, diagram, request flows, trade-offs and how single points of failure are avoided

## How to run the API client

1. Clone or download the repository:

   ```bash
   git clone https://github.com/YOUR-USERNAME/quicknotes-system-design.git
   ```

2. Open the `quicknotes-system-design` folder in VS Code.
3. Install the **Live Server** extension if you do not have it yet.
4. Right-click `index.html` and choose **Open with Live Server**.
5. Click **Load notes** to fetch 10 notes, add a note with the form, and use **Delete** on a note.

You need an internet connection, because the client calls `https://jsonplaceholder.typicode.com/posts`. JSONPlaceholder is a practice API: it replies to create and delete requests but does not really save anything, so created notes disappear when you reload the page.

## Design documents

- [API design](docs/api-design.md)
- [Data model](docs/data-model.md)
- [Architecture](docs/architecture.md)

## What I learned

- **How `fetch` works with `async` and `await`:** `fetch` does not throw on a 404 or 500, so I check `response.ok` myself, and I wrap every request in `try`, `catch` and `finally` so the app always shows a clear message and re-enables its buttons.
- **How to design an API:** REST uses plural nouns for resources and the HTTP method for the action, and good status codes (201, 204, 400, 401, 403, 404) tell the client exactly what happened.
- **How to model data:** one-to-many relationships use a foreign key, many-to-many relationships need a join table, and indexes make the queries I run most often faster.
- **How systems scale:** estimating the load first shows what to build. QuickNotes is read-heavy, so a cache, read replicas and a CDN do most of the work, and stateless app servers behind a load balancer remove single points of failure.
