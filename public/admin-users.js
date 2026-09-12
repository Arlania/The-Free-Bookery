const usersList = document.querySelector("[data-users-list]");
const usersMessage = document.querySelector("[data-users-message]");
const usersFilters = document.querySelector("[data-users-filters]");
const usersPrevious = document.querySelector("[data-users-previous]");
const usersNext = document.querySelector("[data-users-next]");
const usersPageLabel = document.querySelector("[data-users-page]");
const createUserForm = document.querySelector("[data-user-create-form]");
let usersPage = 1;
let usersHasMore = false;

function formatUserDate(value) {
  if (!value) return "Unknown";
  const normalized = String(value).includes("T") ? value : `${String(value).replace(" ", "T")}Z`;
  const date = new Date(normalized);
  return Number.isNaN(date.valueOf()) ? value : date.toLocaleString();
}

async function mutateUser(userId, method, payload) {
  const response = await fetch(`/api/admin/users/${encodeURIComponent(userId)}`, {
    method, headers: payload ? { "Content-Type": "application/json" } : undefined,
    body: payload ? JSON.stringify(payload) : undefined,
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || "User could not be updated.");
  return result;
}

function sessionDetails(sessions) {
  const details = document.createElement("details");
  details.className = "owner-session-details";
  const summary = document.createElement("summary");
  const active = sessions.some((session) => session.activeNow);
  summary.textContent = active ? `Active recently · ${sessions.length} session${sessions.length === 1 ? "" : "s"}` : `${sessions.length} session${sessions.length === 1 ? "" : "s"}`;
  if (active) summary.classList.add("is-active");
  const list = document.createElement("div");
  list.className = "owner-session-list";
  if (!sessions.length) list.textContent = "No stored login sessions.";
  sessions.forEach((session) => {
    const item = document.createElement("article");
    const status = document.createElement("strong");
    status.textContent = session.activeNow ? "Active recently" : session.sessionValid ? "Valid session" : "Expired session";
    const ip = document.createElement("p"); ip.textContent = `IP address: ${session.ipAddress}`;
    const device = document.createElement("p"); device.textContent = session.userAgent;
    const dates = document.createElement("p"); dates.textContent = `Started ${formatUserDate(session.createdAt)} · Last activity ${formatUserDate(session.lastActiveAt)}`;
    item.append(status, ip, device, dates); list.append(item);
  });
  details.append(summary, list);
  return details;
}

function renderUsers(users) {
  usersList.replaceChildren();
  if (!users.length) {
    const empty = document.createElement("div"); empty.className = "feed-empty";
    empty.innerHTML = "<h2>No matching users</h2><p>Try changing the filters above.</p>";
    usersList.append(empty); return;
  }
  users.forEach((user) => {
    const card = document.createElement("article"); card.className = "admin-user-card owner-user-card";
    const identity = document.createElement("div");
    const name = document.createElement("h2"); name.textContent = user.display_name;
    const email = document.createElement("p"); email.textContent = user.email || "No email available";
    const id = document.createElement("p"); id.textContent = user.user_id;
    identity.append(name, email, id);
    const controls = document.createElement("div"); controls.className = "owner-user-controls";
    const role = document.createElement("select"); role.setAttribute("aria-label", `Role for ${user.display_name}`);
    ["reader", "author", "admin"].forEach((value) => { const option = document.createElement("option"); option.value = value; option.textContent = value[0].toUpperCase() + value.slice(1); role.append(option); });
    role.value = user.role; role.disabled = Boolean(user.is_owner);
    role.addEventListener("change", async () => { role.disabled = true; try { await mutateUser(user.user_id, "PATCH", { role: role.value }); await loadUsers(); } catch (error) { usersMessage.textContent = error.message; role.value = user.role; role.disabled = false; } });
    controls.append(role);
    if (!user.is_owner) {
      const remove = document.createElement("button"); remove.type = "button"; remove.className = "owner-delete-user"; remove.textContent = "Delete account";
      remove.addEventListener("click", async () => {
        if (!confirm(`Delete ${user.display_name}'s login account? They will be signed out and will no longer be able to log in.`)) return;
        remove.disabled = true; try { await mutateUser(user.user_id, "DELETE"); await loadUsers(); } catch (error) { usersMessage.textContent = error.message; remove.disabled = false; }
      });
      controls.append(remove);
    }
    const joined = document.createElement("p"); joined.textContent = `Joined ${formatUserDate(user.created_at)}`;
    const sessions = sessionDetails(user.sessions || []);
    card.append(identity, controls, joined, sessions); usersList.append(card);
  });
}

async function loadUsers() {
  usersMessage.textContent = "Loading users…";
  const data = new FormData(usersFilters);
  const params = new URLSearchParams({ page: String(usersPage), limit: "30" });
  for (const [key, value] of data) if (String(value).trim()) params.set(key, String(value).trim());
  try {
    const response = await fetch(`/api/admin/users?${params}`);
    if (response.status === 401) { location.href = "index.html?login=1"; return; }
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Owner access is required.");
    renderUsers(result.users); usersHasMore = result.hasMore;
    usersMessage.textContent = `${result.total} user${result.total === 1 ? "" : "s"}`;
    usersPageLabel.textContent = `Page ${usersPage}`; usersPrevious.disabled = usersPage === 1; usersNext.disabled = !usersHasMore;
  } catch (error) { usersMessage.textContent = error.message; usersList.replaceChildren(); }
}

createUserForm.addEventListener("submit", async (event) => {
  event.preventDefault(); const message = createUserForm.querySelector("[data-user-create-message]");
  const button = createUserForm.querySelector('button[type="submit"]'); const data = new FormData(createUserForm);
  button.disabled = true; message.textContent = "Creating account…";
  const response = await fetch("/api/admin/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Object.fromEntries(data.entries())) });
  const result = await response.json().catch(() => ({})); button.disabled = false;
  if (!response.ok) { message.textContent = result.error || "Account could not be created."; return; }
  createUserForm.reset(); message.textContent = "Account created."; usersPage = 1; loadUsers();
});
usersFilters.addEventListener("submit", (event) => { event.preventDefault(); usersPage = 1; loadUsers(); });
usersPrevious.addEventListener("click", () => { if (usersPage > 1) { usersPage -= 1; loadUsers(); } });
usersNext.addEventListener("click", () => { if (usersHasMore) { usersPage += 1; loadUsers(); } });
document.querySelector("[data-users-refresh]").addEventListener("click", loadUsers);
loadUsers();
