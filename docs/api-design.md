# QuickNotes API Design

This document describes the **real** QuickNotes API that the backend team should build. It is not the JSONPlaceholder practice API that the front end uses for testing.

## Design rules

- Resources are **plural nouns**: `/notes`, `/tags`. The HTTP method says what to do, so there are no verbs in the URLs.
- A single item is addressed by its id: `/notes/42`.
- Data is sent and received as **JSON**.
- The API is **stateless**. After logging in, the client sends its token in the `Authorization: Bearer <token>` header on **every** request, and the server returns only that user's data.
- All traffic uses **HTTPS**.

## Endpoints

| #   | Method   | Path                       | Description                                        | Success status   |
| --- | -------- | -------------------------- | -------------------------------------------------- | ---------------- |
| 1   | `POST`   | `/auth/login`              | Log in with email and password and receive a token | `200 OK`         |
| 2   | `GET`    | `/notes`                   | List the logged-in user's notes (can be filtered)  | `200 OK`         |
| 3   | `GET`    | `/notes/{id}`              | Get one note                                       | `200 OK`         |
| 4   | `POST`   | `/notes`                   | Create a note                                      | `201 Created`    |
| 5   | `PATCH`  | `/notes/{id}`              | Update some fields of a note                       | `200 OK`         |
| 6   | `DELETE` | `/notes/{id}`              | Delete a note                                      | `204 No Content` |
| 7   | `GET`    | `/tags`                    | List all tags                                      | `200 OK`         |
| 8   | `PUT`    | `/notes/{id}/tags/{tagId}` | Attach a tag to a note                             | `204 No Content` |

### Filtering and searching notes

`GET /notes` accepts **query parameters**, which come after the `?` and are joined with `&`:

- `GET /notes?category=work` returns only work notes
- `GET /notes?search=report` returns notes whose text contains "report"
- `GET /notes?category=work&search=report` combines both

## Request and response examples

### Create a note: `POST /notes`

**Request**

```http
POST /notes HTTP/1.1
Host: api.quicknotes.com
Content-Type: application/json
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

```json
{
  "text": "Buy milk",
  "category": "personal"
}
```

**Response: `201 Created`**

```json
{
  "id": 42,
  "text": "Buy milk",
  "category": "personal",
  "tags": [],
  "createdAt": "2026-09-22T09:15:00Z"
}
```

The server assigns the `id` and `createdAt`. It also checks that the text is 1 to 200 characters.

### List notes: `GET /notes`

**Request**

```http
GET /notes?category=study HTTP/1.1
Host: api.quicknotes.com
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

**Response: `200 OK`**

```json
[
  {
    "id": 1,
    "text": "Revise HTTP methods",
    "category": "study",
    "tags": ["exams", "urgent"],
    "createdAt": "2026-09-21T08:00:00Z"
  },
  {
    "id": 7,
    "text": "Read the SQL chapter",
    "category": "study",
    "tags": [],
    "createdAt": "2026-09-22T07:30:00Z"
  }
]
```

If the user has no matching notes, the server returns an empty array `[]` with status `200`.

## Error responses

Every error uses the same JSON shape, so the client can always read `error` and `message`.

| Status | Name                  | When it happens                                                                               |
| ------ | --------------------- | --------------------------------------------------------------------------------------------- |
| `400`  | Bad Request           | The request is invalid, for example `POST /notes` with empty text or text over 200 characters |
| `401`  | Unauthorized          | The token is missing, expired or invalid, so the server does not know who is asking           |
| `403`  | Forbidden             | The user is logged in but not allowed to do this, for example deleting another user's note    |
| `404`  | Not Found             | The note or URL does not exist, for example `GET /notes/9999`                                 |
| `500`  | Internal Server Error | Something broke on the server, such as the database being unreachable                         |

### Example error bodies

**`400 Bad Request`**

```json
{
  "error": "Bad Request",
  "message": "Note text must be between 1 and 200 characters."
}
```

**`401 Unauthorized`**

```json
{
  "error": "Unauthorized",
  "message": "Your login token is missing or has expired. Please log in again."
}
```

**`403 Forbidden`**

```json
{
  "error": "Forbidden",
  "message": "You can only delete your own notes."
}
```

**`404 Not Found`**

```json
{
  "error": "Not Found",
  "message": "No note with id 9999."
}
```

**`500 Internal Server Error`**

```json
{
  "error": "Internal Server Error",
  "message": "Something went wrong on our side. Please try again later."
}
```
