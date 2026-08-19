const form = document.querySelector("[data-request-form]");
const formMessage = document.querySelector("[data-request-form-message]");
const list = document.querySelector("[data-request-list]");
const listMessage = document.querySelector("[data-request-list-message]");
const previous = document.querySelector("[data-request-previous]");
const next = document.querySelector("[data-request-next]");
const pageLabel = document.querySelector("[data-request-page]");
let page = 1;
let hasMore = false;

function label(value) { return String(value).replace(/_/g, " ").replace(/\b\w/g, (x) => x.toUpperCase()); }
function date(value) {
  const normalized = value?.includes("T") ? value : `${String(value || "").replace(" ", "T")}Z`;
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.valueOf()) ? value : parsed.toLocaleString();
}

function render(requests) {
  list.replaceChildren();
  if (!requests.length) {
    const empty = document.createElement("div");
    empty.className = "feed-empty";
    empty.innerHTML = "<h2>No requests yet</h2><p>Your submitted books will appear here.</p>";
    list.append(empty);
    return;
  }
  requests.forEach((request) => {
    const card = document.createElement("article");
    card.className = "request-card";
    card.id = `request-${request.id}`;
    const header = document.createElement("div");
    const title = document.createElement("h3");
    title.textContent = request.title;
    const status = document.createElement("span");
    status.className = `request-status is-${request.status}`;
    status.textContent = label(request.status);
    header.append(title, status);
    const meta = document.createElement("p");
    meta.textContent = [request.author, request.isbn, label(request.format), date(request.createdAt)].filter(Boolean).join(" · ");
    card.append(header, meta);
    if (request.notes) { const notes = document.createElement("p"); notes.textContent = request.notes; card.append(notes); }
    if (request.adminMessage) { const update = document.createElement("p"); update.className = "request-admin-message"; update.textContent = `Free Bookery: ${request.adminMessage}`; card.append(update); }
    if (request.status === "fulfilled" && request.fulfilledBookId) {
      const link = document.createElement("a");
      link.className = "search-result-link";
      link.href = `reader.html?id=${encodeURIComponent(request.fulfilledBookId)}`;
      link.textContent = "Start reading";
      card.append(link);
    }
    if (request.status === "pending") {
      const cancel = document.createElement("button");
      cancel.type = "button";
      cancel.textContent = "Cancel request";
      cancel.addEventListener("click", async () => {
        cancel.disabled = true;
        const response = await fetch(`/api/book-requests/${request.id}/cancel`, { method: "POST" });
        if (response.ok) load(); else cancel.disabled = false;
      });
      card.append(cancel);
    }
    list.append(card);
  });
  const requestedId = new URLSearchParams(window.location.search).get("request");
  const requestedCard = requestedId && document.getElementById(`request-${requestedId}`);
  if (requestedCard) {
    requestedCard.classList.add("is-targeted");
    requestedCard.scrollIntoView({ behavior: "smooth", block: "center" });
  }
}

async function load() {
  listMessage.textContent = "Loading requests…";
  const response = await fetch(`/api/book-requests?page=${page}&limit=20`);
  if (response.status === 401) { location.href = "index.html?login=1"; return; }
  const result = await response.json();
  if (!response.ok) { listMessage.textContent = result.error || "Requests could not be loaded."; return; }
  render(result.requests);
  hasMore = result.hasMore;
  listMessage.textContent = `${result.total} request${result.total === 1 ? "" : "s"}`;
  pageLabel.textContent = `Page ${page}`;
  previous.disabled = page === 1;
  next.disabled = !hasMore;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = new FormData(form);
  const payload = Object.fromEntries(data.entries());
  formMessage.textContent = "Submitting request…";
  const response = await fetch("/api/book-requests", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
  });
  const result = await response.json();
  if (!response.ok) { formMessage.textContent = result.error || "Request could not be submitted."; return; }
  form.reset();
  formMessage.textContent = "Request submitted.";
  page = 1;
  load();
});
previous.addEventListener("click", () => { if (page > 1) { page -= 1; load(); } });
next.addEventListener("click", () => { if (hasMore) { page += 1; load(); } });
load();
