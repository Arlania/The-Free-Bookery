const list = document.querySelector("[data-activity-list]");
const message = document.querySelector("[data-activity-message]");
const filters = document.querySelector("[data-activity-filters]");
const previous = document.querySelector("[data-activity-previous]");
const next = document.querySelector("[data-activity-next]");
const pageLabel = document.querySelector("[data-activity-page]");
let page = 1;
let hasMore = false;
let facetsLoaded = false;

function formatDate(value) {
  const normalized = value?.includes("T") ? value : `${String(value || "").replace(" ", "T")}Z`;
  const date = new Date(normalized);
  return Number.isNaN(date.valueOf()) ? value : date.toLocaleString();
}

function label(value) {
  return String(value || "").replace(/[._]/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function addFacets(result) {
  if (facetsLoaded) return;
  [["action", result.filters.actions], ["targetType", result.filters.targetTypes]].forEach(([name, values]) => {
    const select = filters.elements[name];
    values.forEach((value) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label(value);
      select.append(option);
    });
  });
  facetsLoaded = true;
}

function valueBlock(title, value) {
  const details = document.createElement("details");
  const summary = document.createElement("summary");
  summary.textContent = title;
  const pre = document.createElement("pre");
  pre.textContent = value == null ? "No value recorded" : JSON.stringify(value, null, 2);
  details.append(summary, pre);
  return details;
}

function render(items) {
  list.replaceChildren();
  if (!items.length) {
    const empty = document.createElement("div");
    empty.className = "feed-empty";
    empty.innerHTML = "<h2>No matching activity</h2><p>Try changing the filters above.</p>";
    list.append(empty);
    return;
  }
  items.forEach((item) => {
    const article = document.createElement("article");
    article.className = "activity-card";
    const heading = document.createElement("div");
    const type = document.createElement("span");
    type.textContent = label(item.targetType);
    const title = document.createElement("h2");
    title.textContent = label(item.action);
    heading.append(type, title);
    const meta = document.createElement("p");
    meta.textContent = `${item.actorName} · ${formatDate(item.createdAt)} · ${item.targetId}`;
    const changes = document.createElement("div");
    changes.className = "activity-values";
    changes.append(valueBlock("Previous value", item.previousValue), valueBlock("New value", item.newValue));
    article.append(heading, meta, changes);
    list.append(article);
  });
}

async function load() {
  message.textContent = "Loading activity…";
  const data = new FormData(filters);
  const params = new URLSearchParams({ page: String(page), limit: "30" });
  for (const [key, value] of data) if (String(value).trim()) params.set(key, String(value).trim());
  try {
    const accountResponse = await fetch("/api/account");
    if (accountResponse.status === 401) { location.href = "index.html?login=1"; return; }
    const account = await accountResponse.json();
    if (!accountResponse.ok || account.role !== "admin") {
      message.textContent = "Admin access is required.";
      list.replaceChildren();
      return;
    }
    const response = await fetch(`/api/admin/activity?${params}`);
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Activity could not be loaded.");
    addFacets(result);
    render(result.activity);
    hasMore = result.hasMore;
    message.textContent = `${result.total} matching event${result.total === 1 ? "" : "s"}`;
    pageLabel.textContent = `Page ${page}`;
    previous.disabled = page === 1;
    next.disabled = !hasMore;
  } catch (error) { message.textContent = error.message; }
}

filters.addEventListener("submit", (event) => { event.preventDefault(); page = 1; load(); });
document.querySelector("[data-activity-refresh]").addEventListener("click", load);
previous.addEventListener("click", () => { if (page > 1) { page -= 1; load(); } });
next.addEventListener("click", () => { if (hasMore) { page += 1; load(); } });
load();
