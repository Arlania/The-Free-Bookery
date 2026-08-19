const list = document.querySelector("[data-notification-list]");
const message = document.querySelector("[data-notifications-message]");
const unreadOnly = document.querySelector("[data-notifications-unread]");
const readAll = document.querySelector("[data-notifications-read-all]");
const previous = document.querySelector("[data-notifications-previous]");
const next = document.querySelector("[data-notifications-next]");
const pageLabel = document.querySelector("[data-notifications-page]");
let page = 1;
let hasMore = false;

function formatDate(value) {
  if (!value) return "";
  const normalized = value.includes("T") ? value : `${value.replace(" ", "T")}Z`;
  const date = new Date(normalized);
  return Number.isNaN(date.valueOf()) ? value : date.toLocaleString();
}

function render(items) {
  list.replaceChildren();
  if (!items.length) {
    const empty = document.createElement("div");
    empty.className = "feed-empty";
    empty.innerHTML = "<h2>You’re all caught up</h2><p>No notifications match this view.</p>";
    list.append(empty);
    return;
  }
  items.forEach((item) => {
    const article = document.createElement("article");
    article.className = "notification-card";
    article.classList.toggle("is-unread", !item.readAt);
    const content = document.createElement("div");
    const heading = document.createElement("h2");
    heading.textContent = item.title;
    const body = document.createElement("p");
    body.textContent = item.message;
    const date = document.createElement("time");
    date.dateTime = item.createdAt;
    date.textContent = formatDate(item.createdAt);
    content.append(heading, body, date);
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = item.readAt ? "Mark unread" : "Mark read";
    button.addEventListener("click", async () => {
      button.disabled = true;
      const response = await fetch(`/api/notifications/${item.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ read: !item.readAt }),
      });
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        message.textContent = result.error || "Notification could not be updated.";
        button.disabled = false;
        return;
      }
      await load();
    });
    article.append(content, button);
    list.append(article);
  });
}

async function load() {
  message.textContent = "Loading notifications…";
  const params = new URLSearchParams({ page: String(page), limit: "20" });
  if (unreadOnly.checked) params.set("unread", "true");
  try {
    const response = await fetch(`/api/notifications?${params}`);
    if (response.status === 401) {
      location.href = "index.html?login=1";
      return;
    }
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Notifications could not be loaded.");
    hasMore = result.hasMore;
    if (page > 1 && !result.notifications.length) { page -= 1; return load(); }
    render(result.notifications);
    message.textContent = `${result.unreadCount} unread · ${result.total} notification${result.total === 1 ? "" : "s"} in this view`;
    pageLabel.textContent = `Page ${page}`;
    previous.disabled = page === 1;
    next.disabled = !hasMore;
    readAll.disabled = result.unreadCount === 0;
  } catch (error) {
    message.textContent = error.message;
  }
}

unreadOnly.addEventListener("change", () => { page = 1; load(); });
previous.addEventListener("click", () => { if (page > 1) { page -= 1; load(); } });
next.addEventListener("click", () => { if (hasMore) { page += 1; load(); } });
readAll.addEventListener("click", async () => {
  readAll.disabled = true;
  const response = await fetch("/api/notifications/read-all", { method: "POST" });
  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    message.textContent = result.error || "Notifications could not be updated.";
    readAll.disabled = false;
    return;
  }
  page = 1;
  await load();
});
load();
