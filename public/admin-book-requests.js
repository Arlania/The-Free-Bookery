const list = document.querySelector("[data-admin-request-list]");
const message = document.querySelector("[data-admin-request-message]");
const filters = document.querySelector("[data-admin-request-filters]");
const previous = document.querySelector("[data-admin-request-previous]");
const next = document.querySelector("[data-admin-request-next]");
const pageLabel = document.querySelector("[data-admin-request-page]");
let page = 1, hasMore = false;
const statuses = ["researching", "contacting", "acquired", "fulfilled", "unavailable", "rejected"];
function label(value) { return String(value).replace(/_/g, " ").replace(/\b\w/g, (x) => x.toUpperCase()); }

function render(requests) {
  list.replaceChildren();
  if (!requests.length) { const empty = document.createElement("div"); empty.className = "feed-empty"; empty.innerHTML = "<h2>No matching requests</h2><p>Try another status or search.</p>"; list.append(empty); return; }
  requests.forEach((request) => {
    const card = document.createElement("article"); card.className = "admin-request-card";
    const title = document.createElement("h2"); title.textContent = request.title;
    const details = document.createElement("p"); details.textContent = [request.author, request.isbn, label(request.format)].filter(Boolean).join(" · ") || "No additional book details";
    const reader = document.createElement("p"); reader.textContent = `${request.requester.name} · ${request.requester.email}`;
    const current = document.createElement("strong"); current.className = `request-status is-${request.status}`; current.textContent = label(request.status);
    card.append(title, current, details, reader);
    if (request.notes) { const notes = document.createElement("p"); notes.textContent = `Reader notes: ${request.notes}`; card.append(notes); }
    if (request.adminMessage) { const old = document.createElement("p"); old.textContent = `Latest message: ${request.adminMessage}`; card.append(old); }
    if (!["fulfilled", "unavailable", "rejected", "canceled"].includes(request.status)) {
      const form = document.createElement("form"); form.className = "admin-request-update";
      const statusLabel = document.createElement("label"); statusLabel.textContent = "New status";
      const select = document.createElement("select"); select.name = "status";
      statuses.forEach((value) => { const option = document.createElement("option"); option.value = value; option.textContent = label(value); if (value === request.status) option.selected = true; select.append(option); });
      statusLabel.append(select);
      const bookLabel = document.createElement("label"); bookLabel.textContent = "Catalog book ID (required for Fulfilled)";
      const book = document.createElement("input"); book.name = "bookId"; book.maxLength = 100; bookLabel.append(book);
      const messageLabel = document.createElement("label"); messageLabel.textContent = "Message to reader";
      const textarea = document.createElement("textarea"); textarea.name = "message"; textarea.maxLength = 2000; textarea.rows = 3; messageLabel.append(textarea);
      const status = document.createElement("p"); status.setAttribute("role", "status");
      const submit = document.createElement("button"); submit.type = "submit"; submit.textContent = "Save update";
      form.append(statusLabel, bookLabel, messageLabel, status, submit);
      form.addEventListener("submit", async (event) => {
        event.preventDefault(); submit.disabled = true; status.textContent = "Saving…";
        const response = await fetch(`/api/admin/book-requests/${request.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: select.value, bookId: book.value.trim(), message: textarea.value.trim() }) });
        const result = await response.json();
        if (!response.ok) { status.textContent = result.error || "Update could not be saved."; submit.disabled = false; return; }
        load();
      });
      card.append(form);
    }
    list.append(card);
  });
}

async function load() {
  const data = new FormData(filters); const params = new URLSearchParams({ page: String(page), limit: "30" });
  for (const [key, value] of data) if (String(value).trim()) params.set(key, String(value).trim());
  const accountResponse = await fetch("/api/account");
  if (accountResponse.status === 401) { location.href = "index.html?login=1"; return; }
  const account = await accountResponse.json();
  if (!accountResponse.ok || account.role !== "admin") { message.textContent = "Admin access is required."; return; }
  const response = await fetch(`/api/admin/book-requests?${params}`); const result = await response.json();
  if (!response.ok) { message.textContent = result.error || "Requests could not be loaded."; return; }
  render(result.requests); hasMore = result.hasMore; message.textContent = `${result.total} matching request${result.total === 1 ? "" : "s"}`;
  pageLabel.textContent = `Page ${page}`; previous.disabled = page === 1; next.disabled = !hasMore;
}
filters.addEventListener("submit", (event) => { event.preventDefault(); page = 1; load(); });
document.querySelector("[data-admin-request-refresh]").addEventListener("click", load);
previous.addEventListener("click", () => { if (page > 1) { page -= 1; load(); } });
next.addEventListener("click", () => { if (hasMore) { page += 1; load(); } });
load();
