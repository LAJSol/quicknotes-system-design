// ---------- 1. Settings and the elements we need ----------
const API_URL = "https://jsonplaceholder.typicode.com/posts";
const MAX_TITLE_LENGTH = 100;

const loadBtn = document.querySelector("#load-btn");
const statusText = document.querySelector("#status");
const form = document.querySelector("#noteform");
const titleInput = document.querySelector("#title-input");
const bodyInput = document.querySelector("#body-input");
const submitBtn = document.querySelector("#submit-btn");
const list = document.querySelector("#notes-list");

// The notes currently shown on the page
let notes = [];

// ---------- 2. One reusable function for every request ----------
// Calls fetch, throws an error if the status is not 200-299, and returns
// the status code together with the parsed JSON data.
async function request(url, options = {}) {
  const response = await fetch(url, options);

  if (!response.ok) {
    const error = new Error(`Request failed with status ${response.status}`);
    error.status = response.status; // so callers can react to a 404, 500, ...
    throw error;
  }

  // Read the body as text first: a DELETE reply may be empty
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  return { status: response.status, data: data };
}

// ---------- 3. The API calls: GET and POST ----------
async function fetchNotes() {
  return request(`${API_URL}?_limit=10`); // GET: load 10 notes
}

async function createNote(title, body) {
  return request(API_URL, {
    method: "POST", // POST: create
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: title, body: body, userId: 1 }),
  });
}

// ---------- 4. Showing messages and drawing notes ----------
// type is "loading", "success" or "error" (it picks the style in style.css)
function setStatus(message, type = "") {
  statusText.textContent = message;
  statusText.className = type;
}

// Disable the buttons while a request is running
function setBusy(isBusy) {
  loadBtn.disabled = isBusy;
  submitBtn.disabled = isBusy;
}

function createNoteElement(note) {
  const li = document.createElement("li");
  li.classList.add("note");

  const content = document.createElement("div");

  const title = document.createElement("h3");
  title.textContent = note.title; // textContent only: typed text can never run as code
  content.appendChild(title);

  if (note.body) {
    const body = document.createElement("p");
    body.textContent = note.body;
    content.appendChild(body);
  }

  li.appendChild(content);
  return li;
}

function render() {
  list.replaceChildren(); // clear the old list

  // Empty state
  if (notes.length === 0) {
    const empty = document.createElement("li");
    empty.classList.add("empty-message");
    empty.textContent = "No notes to show yet. Load notes or create one.";
    list.appendChild(empty);
    return;
  }

  notes.forEach((note) => list.appendChild(createNoteElement(note)));
}

function validateTitle(title) {
  if (title === "") return "Please enter a title.";
  if (title.length > MAX_TITLE_LENGTH) {
    return `The title must be ${MAX_TITLE_LENGTH} characters or fewer.`;
  }
  return "";
}

// ---------- 5. Event handlers: every request is wrapped in try / catch / finally ----------
async function handleLoad() {
  setStatus("Loading notes...", "loading");
  setBusy(true);

  try {
    const result = await fetchNotes();
    notes = result.data;
    render();

    if (notes.length === 0) {
      setStatus("The server returned no notes.", "success");
    } else {
      setStatus(`Loaded ${notes.length} notes from the server.`, "success");
    }
  } catch (error) {
    setStatus("Could not load notes. Please try again.", "error");
    console.error(error);
  } finally {
    setBusy(false); // runs whether the request worked or failed
  }
}

async function handleCreate(event) {
  event.preventDefault();

  const title = titleInput.value.trim();
  const body = bodyInput.value.trim(); // the body is optional

  const problem = validateTitle(title);
  if (problem) {
    setStatus(problem, "error");
    return;
  }

  setStatus("Creating note...", "loading");
  setBusy(true);

  try {
    const result = await createNote(title, body);
    const created = { ...result.data, createdHere: true };

    notes.unshift(created); // newest note goes to the top
    render();
    setStatus(
      `Note created (status ${result.status}, id ${created.id}).`,
      "success",
    );

    titleInput.value = "";
    bodyInput.value = "";
  } catch (error) {
    setStatus("Could not create the note. Please try again.", "error");
    console.error(error);
  } finally {
    setBusy(false);
  }
}

// ---------- 6. Listen for the button and the form ----------
loadBtn.addEventListener("click", handleLoad);
form.addEventListener("submit", handleCreate);

// ---------- 7. Draw the empty state when the page first loads ----------
render();
