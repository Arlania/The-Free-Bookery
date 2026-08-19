const usersList = document.querySelector("[data-users-list]");
const usersMessage = document.querySelector("[data-users-message]");
const usersFilters = document.querySelector("[data-users-filters]");
const usersPrevious = document.querySelector("[data-users-previous]");
const usersNext = document.querySelector("[data-users-next]");
const usersPageLabel = document.querySelector("[data-users-page]");
let usersPage = 1;
let usersHasMore = false;

function formatUserDate(value) {
  const date = new Date(String(value || "").replace(" ", "T") + "Z");
  return Number.isNaN(date.valueOf()) ? value : date.toLocaleDateString();
}

function renderUsers(users) {
  usersList.replaceChildren();
  if (!users.length) {
    const empty = document.createElement("div");
    empty.className = "feed-empty";
    empty.innerHTML = "<h2>No matching users</h2><p>Try changing the filters above.</p>";
    usersList.append(empty);
    return;
  }
  users.forEach((user) => {
    const card = document.createElement("article");
    card.className = "admin-user-card";
    const identity = document.createElement("div");
    const name = document.createElement("h2");
    name.textContent = user.display_name;
    const id = document.createElement("p");
    id.textContent = user.user_id;
    identity.append(name, id);
    const role = document.createElement("span");
    role.className = `admin-user-role is-${user.role}`;
    role.textContent = user.role[0].toUpperCase() + user.role.slice(1);
    const joined = document.createElement("p");
    joined.textContent = `Joined ${formatUserDate(user.created_at)}`;
    card.append(identity, role, joined);
    usersList.append(card);
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
    if (!response.ok) throw new Error(result.error || "Users could not be loaded.");
    renderUsers(result.users);
    usersHasMore = result.hasMore;
    usersMessage.textContent = `${result.total} user${result.total === 1 ? "" : "s"}`;
    usersPageLabel.textContent = `Page ${usersPage}`;
    usersPrevious.disabled = usersPage === 1;
    usersNext.disabled = !usersHasMore;
  } catch (error) { usersMessage.textContent = error.message; }
}

usersFilters.addEventListener("submit", (event) => { event.preventDefault(); usersPage = 1; loadUsers(); });
usersPrevious.addEventListener("click", () => { if (usersPage > 1) { usersPage -= 1; loadUsers(); } });
usersNext.addEventListener("click", () => { if (usersHasMore) { usersPage += 1; loadUsers(); } });
document.querySelector("[data-users-refresh]").addEventListener("click", loadUsers);
loadUsers();
