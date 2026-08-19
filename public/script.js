const signInModal = document.querySelector("#signin-modal");
const openSignIn = document.querySelector('[data-modal-open="signin-modal"]');
const closeSignIn = signInModal?.querySelector(".modal-close");
const signInForm = signInModal?.querySelector(".signin-form");
const signInMessage = signInModal?.querySelector(".signin-message");
const signupForm = document.querySelector(".signup-form");
const readingRequiredNotice = document.querySelector(
  ".reading-required-notice"
);
const requiredLoginLink = document.querySelector(".required-login-link");
const modalSignupLink = signInModal?.querySelector(".signup-prompt a");
const loginLink = document.querySelector(".login-link");
const userMenu = document.querySelector(".user-menu");
const userButton = document.querySelector(".user-button");
const userName = document.querySelector(".user-name");
const pageUserName = document.querySelector(".page-user-name");
const logoutButton = document.querySelector(".logout-button");
const collectionsGrid = document.querySelector("[data-collections-grid]");
const createCollectionButton = document.querySelector(".create-collection-card");
const collectionModal = document.querySelector("#collection-modal");
const closeCollectionModal = document.querySelector("[data-collection-modal-close]");
const collectionForm = document.querySelector(".collection-form");
const collectionNameInput = document.querySelector("#collection-name");
const collectionMessage = document.querySelector(".collection-message");
const collectionModalTitle = document.querySelector("#collection-modal-title");
const collectionSubmitButton = collectionForm?.querySelector('button[type="submit"]');
const collectionTitle = document.querySelector("[data-collection-title]");
const bookshelf = document.querySelector("[data-bookshelf]");
const deleteCollectionModal = document.querySelector(
  "#delete-collection-modal"
);
const closeDeleteCollectionModal = document.querySelector(
  "[data-delete-collection-close]"
);
const cancelDeleteCollection = document.querySelector(
  "[data-delete-collection-cancel]"
);
const confirmDeleteCollection = document.querySelector(
  ".confirm-delete-collection"
);
const deleteCollectionWarning = document.querySelector(
  ".delete-collection-warning"
);
const contactForm = document.querySelector(".contact-form");
const contactFormMessage = document.querySelector(".contact-form-message");
const donorTypeOptions = document.querySelectorAll('[name="donor-type"]');
const donorTypeHeading = document.querySelector("[data-donor-heading]");
const donorTypeDescription = document.querySelector("[data-donor-description]");
const bookSearchForm = document.querySelector(".book-search-form");
const bookSearchInput = document.querySelector("#book-search");
const searchPage = document.querySelector(".search-page");
const searchResults = document.querySelector(".search-results");
const searchResultsGrid = document.querySelector(".search-results-grid");
const searchResultsCount = document.querySelector(".search-results-count");
const searchStatus = document.querySelector(".search-status");
const searchResultTabs = document.querySelectorAll(".search-result-tab");
const recentSearchList = document.querySelector(".recent-search-list");
const recentSearchesEmpty = document.querySelector(".recent-searches-empty");
const homeSearchForm = document.querySelector(".home-search-form");
const homeSearchInput = document.querySelector("#home-book-search");
const homeRecentSearches = document.querySelector(".home-recent-searches");
const homeRecentSearchList = document.querySelector(
  ".home-recent-search-list"
);
const blogPostTexts = document.querySelectorAll(".blog-post-text");
const blogFilterButton = document.querySelector(".blog-filter-button");
const blogFilterMenu = document.querySelector(".blog-filter-menu");
const blogFilterOptions = document.querySelectorAll("[data-blog-filter]");
const blogPostCards = document.querySelectorAll("[data-blog-category]");
const saveBookModal = document.querySelector("#save-book-modal");
const closeSaveBookModal = document.querySelector("[data-save-book-close]");
const saveBookForm = document.querySelector(".save-book-form");
const saveBookName = document.querySelector(".save-book-name");
const saveBookCollection = document.querySelector("#save-book-collection");
const newCollectionField = document.querySelector(".new-collection-field");
const newCollectionInput = document.querySelector(
  "#save-book-new-collection"
);
const saveBookMessage = document.querySelector(".save-book-message");
const creatorPublicPage = document.querySelector(".creator-access-page");
const creatorDashboard = document.querySelector("[data-creator-dashboard]");
const creatorTitleGrid = document.querySelector("[data-creator-title-grid]");
const creatorEmptyLibrary = document.querySelector("[data-creator-empty-library]");
const creatorTitleModal = document.querySelector("[data-creator-title-modal]");
const creatorTitleForm = document.querySelector(".creator-title-form");
const creatorFormMessage = document.querySelector("[data-creator-form-message]");
const creatorReview = document.querySelector("[data-creator-review]");
const creatorNextButton = document.querySelector("[data-creator-form-next]");
const creatorBackButton = document.querySelector("[data-creator-form-back]");
const creatorDraftButton = document.querySelector("[data-creator-form-draft]");
const creatorSubmitButton = document.querySelector("[data-creator-form-submit]");
const creatorApplicationStatus = document.querySelector(
  "[data-creator-application-status]"
);
const starredGrid = document.querySelector("[data-starred-grid]");
const creatorApplicationOpenButtons = document.querySelectorAll(
  "[data-creator-application-open]"
);
const recentSearchesStorageKey = "freeBookNookRecentSearches";
const homeRecentSearchPreviewCount = 3;
const sampleBooks = [
  {
    title: "Moonlit Margins",
    author: "A. Rivera",
    color: "#7d4f50",
  },
  {
    title: "The Open Chapter",
    author: "Lena Brooks",
    color: "#2f6f73",
  },
  {
    title: "Kitchen Notes",
    author: "M. Ito",
    color: "#b06f3c",
  },
  {
    title: "Library of Clouds",
    author: "Sam Chen",
    color: "#4f5f8f",
  },
];
const defaultCollections = [
  {
    id: "collection-1",
    name: "Collection 1",
    books: sampleBooks,
  },
];
let latestSearchBooks = [];
let latestSearchQuery = "";
let activeSearchScope = "all";
let bookBeingSaved = null;
let saveBookTrigger = null;
let homeRecentSearchesExpanded = false;
let creatorFormStep = 1;
const sessionHintKey = "freeBookNookSessionHint";
function getSessionHint() {
  try {
    const hint = JSON.parse(localStorage.getItem(sessionHintKey) || "null");
    return hint?.name && hint?.role ? hint : null;
  } catch { return null; }
}
const sessionHint = getSessionHint();
let currentAccount = sessionHint
  ? { authenticated: true, name: sessionHint.name, role: sessionHint.role, unreadNotificationCount: sessionHint.unread || 0 }
  : null;
let creatorApplicationData = null;
let creatorBooks = [];
let activeCreatorBook = null;
let readerCollections = [];
let starredBooks = [];

const libraryTabs = [...document.querySelectorAll("[data-library-tab]")];
const libraryPanels = [...document.querySelectorAll("[data-library-panel]")];
function selectLibraryTab(name) {
  libraryTabs.forEach((tab) => {
    const selected = tab.dataset.libraryTab === name;
    tab.setAttribute("aria-selected", String(selected));
    tab.tabIndex = selected ? 0 : -1;
  });
  libraryPanels.forEach((panel) => {
    panel.hidden = panel.dataset.libraryPanel !== name;
  });
}
libraryTabs.forEach((tab) => tab.addEventListener("click", () => selectLibraryTab(tab.dataset.libraryTab)));
if (libraryTabs.length) selectLibraryTab(window.location.hash === "#starred" ? "starred" : "collections");

if (modalSignupLink) {
  const forgotPasswordLink = document.createElement("a");
  forgotPasswordLink.href = "forgot-password.html";
  forgotPasswordLink.className = "forgot-password-link";
  forgotPasswordLink.textContent = "Forgot password?";
  modalSignupLink.closest(".signup-prompt")?.after(forgotPasswordLink);
}

const signInPassword = signInModal?.querySelector('input[name="password"]');
if (signInPassword) {
  const passwordField = document.createElement("div");
  passwordField.className = "password-field";
  signInPassword.before(passwordField);
  passwordField.append(signInPassword);

  const passwordToggle = document.createElement("button");
  passwordToggle.className = "password-visibility-toggle";
  passwordToggle.type = "button";
  passwordToggle.setAttribute("aria-label", "Show password");
  passwordToggle.setAttribute("aria-pressed", "false");
  passwordToggle.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"></path><circle cx="12" cy="12" r="2.75"></circle></svg>';
  passwordToggle.addEventListener("click", () => {
    const showing = signInPassword.type === "text";
    signInPassword.type = showing ? "password" : "text";
    passwordToggle.setAttribute("aria-label", showing ? "Show password" : "Hide password");
    passwordToggle.setAttribute("aria-pressed", String(!showing));
  });
  passwordField.append(passwordToggle);
}

function getRecentSearches() {
  try {
    const searches = JSON.parse(
      localStorage.getItem(recentSearchesStorageKey) || "[]"
    );
    return Array.isArray(searches) ? searches : [];
  } catch {
    return [];
  }
}

function saveRecentSearch(query) {
  const normalizedQuery = query.trim();
  const searches = getRecentSearches().filter(
    (search) => search.toLowerCase() !== normalizedQuery.toLowerCase()
  );

  searches.unshift(normalizedQuery);
  localStorage.setItem(
    recentSearchesStorageKey,
    JSON.stringify(searches)
  );
}

function deleteRecentSearch(query) {
  const searches = getRecentSearches().filter(
    (search) => search.toLowerCase() !== query.toLowerCase()
  );
  localStorage.setItem(recentSearchesStorageKey, JSON.stringify(searches));
  renderRecentSearches();
  renderHomeRecentSearches();
}

function runSearch(query) {
  if (!bookSearchInput || !query.trim()) {
    return;
  }

  const normalizedQuery = query.trim();
  bookSearchInput.value = normalizedQuery;
  searchPage?.classList.add("has-search-results");
  saveRecentSearch(normalizedQuery);
  searchBooks(normalizedQuery);
}

function renderRecentSearches() {
  if (!recentSearchList || !recentSearchesEmpty) {
    return;
  }

  const searches = getRecentSearches();
  recentSearchList.replaceChildren();
  recentSearchesEmpty.hidden = searches.length > 0;

  searches.forEach((query) => {
    const chip = document.createElement("span");
    chip.className = "recent-search-chip";

    const searchButton = document.createElement("button");
    searchButton.className = "recent-search-term";
    searchButton.type = "button";
    searchButton.textContent = query;
    searchButton.addEventListener("click", () => runSearch(query));

    const deleteButton = document.createElement("button");
    deleteButton.className = "recent-search-delete";
    deleteButton.type = "button";
    deleteButton.setAttribute(
      "aria-label",
      `Delete ${query} from recent searches`
    );
    deleteButton.innerHTML = "&times;";
    deleteButton.addEventListener("click", () => deleteRecentSearch(query));

    chip.append(searchButton, deleteButton);
    recentSearchList.append(chip);
  });
}

function closeHomeRecentSearches() {
  if (!homeRecentSearches || !homeSearchInput) return;
  homeRecentSearches.hidden = true;
  homeSearchInput.setAttribute("aria-expanded", "false");
}

function renderHomeRecentSearches() {
  if (!homeRecentSearchList || !homeRecentSearches || !homeSearchInput) return;

  const searches = getRecentSearches();
  const visibleSearches = homeRecentSearchesExpanded
    ? searches
    : searches.slice(0, homeRecentSearchPreviewCount);
  homeRecentSearchList.replaceChildren();
  homeRecentSearches.hidden = searches.length === 0;
  homeSearchInput.setAttribute("aria-expanded", String(searches.length > 0));

  visibleSearches.forEach((query) => {
    const item = document.createElement("div");
    item.className = "home-recent-search-item";

    const searchButton = document.createElement("button");
    searchButton.className = "home-recent-search-term";
    searchButton.type = "button";
    searchButton.textContent = query;
    searchButton.addEventListener("click", () => {
      homeSearchInput.value = query;
      saveRecentSearch(query);
      window.location.href = `search.html?query=${encodeURIComponent(query)}`;
    });

    const deleteButton = document.createElement("button");
    deleteButton.className = "home-recent-search-delete";
    deleteButton.type = "button";
    deleteButton.setAttribute(
      "aria-label",
      `Delete ${query} from recent searches`
    );
    deleteButton.innerHTML = "&times;";
    deleteButton.addEventListener("click", (event) => {
      event.stopPropagation();
      deleteRecentSearch(query);
    });

    item.append(searchButton, deleteButton);
    homeRecentSearchList.append(item);
  });

  if (searches.length > homeRecentSearchPreviewCount) {
    const moreButton = document.createElement("button");
    moreButton.className = "home-recent-search-more";
    moreButton.type = "button";
    moreButton.textContent = homeRecentSearchesExpanded ? "Show less" : "More";
    moreButton.setAttribute("aria-expanded", String(homeRecentSearchesExpanded));
    moreButton.addEventListener("click", (event) => {
      event.stopPropagation();
      homeRecentSearchesExpanded = !homeRecentSearchesExpanded;
      renderHomeRecentSearches();
    });
    homeRecentSearchList.append(moreButton);
  } else {
    homeRecentSearchesExpanded = false;
  }
}

homeSearchInput?.addEventListener("focus", renderHomeRecentSearches);
homeSearchInput?.addEventListener("click", renderHomeRecentSearches);

blogFilterButton?.addEventListener("click", (event) => {
  event.stopPropagation();
  const isOpen = blogFilterButton.getAttribute("aria-expanded") === "true";
  blogFilterButton.setAttribute("aria-expanded", String(!isOpen));
  blogFilterMenu.hidden = isOpen;
});

blogFilterMenu?.addEventListener("click", (event) => {
  const option = event.target.closest("[data-blog-filter]");
  if (!option) return;
  const selectedCategory = option.dataset.blogFilter;

  blogFilterOptions.forEach((item) => {
    item.setAttribute("aria-pressed", String(item === option));
  });

  blogPostCards.forEach((card) => {
    card.hidden =
      selectedCategory !== "all" &&
      card.dataset.blogCategory !== selectedCategory;
  });

  blogFilterButton.setAttribute("aria-expanded", "false");
  blogFilterMenu.hidden = true;
});

homeSearchForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  const query = homeSearchInput.value.trim();
  if (!query) return;
  saveRecentSearch(query);
  window.location.href = `search.html?query=${encodeURIComponent(query)}`;
});

document.addEventListener("click", (event) => {
  if (homeSearchForm && !homeSearchForm.contains(event.target)) {
    closeHomeRecentSearches();
  }
});

function setupBlogPostPreviews() {
  blogPostTexts.forEach((postText, index) => {
    if (postText.scrollHeight <= postText.clientHeight + 1) return;

    const toggle = document.createElement("button");
    const textId = `blog-post-text-${index + 1}`;
    postText.id = textId;
    toggle.className = "blog-post-toggle";
    toggle.type = "button";
    toggle.textContent = "Show more";
    toggle.setAttribute("aria-controls", textId);
    toggle.setAttribute("aria-expanded", "false");

    toggle.addEventListener("click", () => {
      const expanded = postText.classList.toggle("is-expanded");
      toggle.textContent = expanded ? "Show less" : "Show more";
      toggle.setAttribute("aria-expanded", String(expanded));
    });

    postText.insertAdjacentElement("afterend", toggle);
  });
}
let collectionModalMode = "create";
let collectionBeingRenamed = null;
let collectionBeingDeleted = null;
let deleteCollectionTrigger = null;

function formatNotificationDate(value) {
  const normalized = value?.includes("T") ? value : `${String(value || "").replace(" ", "T")}Z`;
  const date = new Date(normalized);
  return Number.isNaN(date.valueOf()) ? "" : date.toLocaleString();
}

function notificationDestination(item) {
  if (item.relatedRecordType === "book_request") {
    return `book-requests.html?request=${encodeURIComponent(item.relatedRecordId || "")}`;
  }
  if (item.relatedRecordType === "author_application") return "creator-access.html";
  if (item.relatedRecordType === "book") return "creator-access.html";
  return "notifications.html";
}

function updateNotificationBellCount(count) {
  if (currentAccount) currentAccount.unreadNotificationCount = Math.max(0, Number(count) || 0);
  const hint = getSessionHint();
  if (hint) localStorage.setItem(sessionHintKey, JSON.stringify({ ...hint, unread: Math.max(0, Number(count) || 0) }));
  document.querySelectorAll(".notification-bell").forEach((bell) => {
    bell.querySelector(".notification-badge")?.remove();
    if (count > 0) {
      const badge = document.createElement("span");
      badge.className = "notification-badge";
      badge.textContent = count > 99 ? "99+" : String(count);
      bell.append(badge);
    }
    bell.setAttribute("aria-label", count > 0 ? `Notifications, ${count} unread` : "Notifications");
  });
}

function setupNotificationDrawer(bell) {
  if (bell.dataset.drawerReady || currentAccount?.role === "admin") return;
  bell.dataset.drawerReady = "true";
  bell.setAttribute("aria-haspopup", "dialog");
  bell.setAttribute("aria-expanded", "false");
  const drawer = document.createElement("aside");
  drawer.className = "notification-drawer";
  drawer.hidden = true;
  drawer.setAttribute("aria-label", "Notifications");
  drawer.innerHTML = '<header><h2>Notifications</h2><button type="button" aria-label="Close notifications">&times;</button></header><p class="notification-drawer-status">Loading notifications…</p><div class="notification-drawer-list"></div>';
  document.body.append(drawer);
  const status = drawer.querySelector(".notification-drawer-status");
  const list = drawer.querySelector(".notification-drawer-list");
  const close = () => { drawer.hidden = true; bell.setAttribute("aria-expanded", "false"); };
  drawer.querySelector("header button").addEventListener("click", close);

  async function loadDrawer() {
    status.textContent = "Loading notifications…";
    const response = await fetch("/api/notifications?page=1&limit=20");
    const result = await response.json().catch(() => ({}));
    if (!response.ok) { status.textContent = result.error || "Notifications could not be loaded."; return; }
    updateNotificationBellCount(result.unreadCount);
    list.replaceChildren();
    status.textContent = result.notifications.length ? "" : "You’re all caught up.";
    result.notifications.forEach((item) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "notification-drawer-item";
      button.classList.toggle("is-unread", !item.readAt);
      const title = document.createElement("strong");
      title.textContent = item.title;
      const message = document.createElement("span");
      message.textContent = item.message;
      const time = document.createElement("time");
      time.textContent = formatNotificationDate(item.createdAt);
      button.append(title, message, time);
      button.addEventListener("click", () => {
        window.location.href = notificationDestination(item);
      });
      list.append(button);
    });
  }

  bell.addEventListener("click", async (event) => {
    event.preventDefault();
    const opening = drawer.hidden;
    drawer.hidden = !opening;
    bell.setAttribute("aria-expanded", String(opening));
    if (opening) {
      const readAllResponse = await fetch("/api/notifications/read-all", { method: "POST" }).catch(() => null);
      if (readAllResponse?.ok) updateNotificationBellCount(0);
      loadDrawer();
    }
  });
}

function updateUserState() {
  const loggedIn = Boolean(currentAccount?.authenticated);
  const displayName = currentAccount?.name || currentAccount?.email || "Guest";

  document.querySelectorAll('a[href="#starred"]').forEach((link) => {
    link.remove();
  });

  if (loginLink) {
    loginLink.hidden = loggedIn;
  }

  if (userMenu) {
    userMenu.hidden = !loggedIn;
  }

  if (loggedIn && userName) {
    userName.textContent = displayName;
  }

  if (loggedIn) {
    document.querySelectorAll(".account-dropdown").forEach((dropdown) => {
      const makeMenuLink = (href, text) => {
        const link = document.createElement("a");
        link.href = href;
        link.role = "menuitem";
        link.textContent = text;
        return link;
      };
      const items = currentAccount.role === "admin"
        ? [
            makeMenuLink("admin-book-requests.html", "Book requests"),
            makeMenuLink("admin-submissions.html", "Creator submissions"),
            makeMenuLink("admin-users.html", "Users"),
            makeMenuLink("admin-activity.html", "Activity log"),
          ]
        : [
            makeMenuLink("collections.html", "Collections"),
            makeMenuLink("creator-access.html", "Creator Access"),
            makeMenuLink("book-requests.html", "Request book"),
            makeMenuLink("contact.html", "Contact Us"),
          ];
      dropdown.replaceChildren(...items, logoutButton);
    });

    document.querySelectorAll(".nav-right").forEach((navigation) => {
      const menu = navigation.querySelector(".user-menu");
      if (!menu) return;
      let bell = navigation.querySelector(".notification-bell");
      if (currentAccount.role === "admin" && bell?.dataset.drawerReady) {
        const replacement = bell.cloneNode(true);
        delete replacement.dataset.drawerReady;
        bell.replaceWith(replacement);
        bell = replacement;
      }
      if (!bell) {
        bell = document.createElement("a");
        bell.className = "notification-bell";
        bell.href = "notifications.html";
        bell.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"></path><path d="M10 21h4"></path></svg>';
        menu.before(bell);
      }
      const unread = Number(currentAccount?.unreadNotificationCount || 0);
      bell.querySelector(".notification-badge")?.remove();
      if (unread > 0) {
        const badge = document.createElement("span");
        badge.className = "notification-badge";
        badge.textContent = unread > 99 ? "99+" : String(unread);
        bell.append(badge);
      }
      bell.setAttribute("aria-label", unread > 0 ? `Notifications, ${unread} unread` : "Notifications");
      setupNotificationDrawer(bell);
    });
  } else {
    document.querySelectorAll(".notification-bell").forEach((bell) => bell.remove());
  }

  if (pageUserName) {
    pageUserName.textContent = loggedIn ? displayName : "Guest";
  }

  document.querySelectorAll(".admin-role-switcher").forEach((switcher) => {
    if (!currentAccount?.canSwitchRole) switcher.remove();
  });

  if (currentAccount?.canSwitchRole) {
    document.querySelectorAll(".account-dropdown").forEach((dropdown) => {
      let switcher = dropdown.querySelector(".admin-role-switcher");
      if (!switcher) {
        switcher = document.createElement("div");
        switcher.className = "admin-role-switcher";
        const label = document.createElement("label");
        label.textContent = "Owner · View as";
        const select = document.createElement("select");
        select.setAttribute("aria-label", "View site as account role");
        ["reader", "author", "admin"].forEach((role) => {
          const option = document.createElement("option");
          option.value = role;
          option.textContent = role[0].toUpperCase() + role.slice(1);
          select.append(option);
        });
        select.addEventListener("change", async () => {
          select.disabled = true;
          try {
            const response = await fetch("/api/owner/view-as", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ viewAs: select.value }),
            });
            if (!response.ok) throw new Error("View could not be changed.");
            await initializeServerSession();
          } catch {
            select.value = currentAccount?.role || "admin";
            select.disabled = false;
          }
        });
        label.append(select);
        switcher.append(label);
        dropdown.prepend(switcher);
      }
      const select = switcher.querySelector("select");
      select.value = currentAccount.role;
      select.disabled = false;
    });
  }

}

function applyAuthenticatedSession(account) {
  currentAccount = account;
  localStorage.setItem(sessionHintKey, JSON.stringify({
    name: account.name || account.email,
    role: account.role,
    unread: Number(account.unreadNotificationCount || 0),
  }));
  updateUserState();
  renderCreatorDashboard();
}

async function initializeServerSession() {
  try {
    const response = await fetch("/api/account", {
      headers: { Accept: "application/json" },
    });
    if (response.ok) {
      applyAuthenticatedSession(await response.json());
    } else {
      currentAccount = null;
      localStorage.removeItem(sessionHintKey);
      updateUserState();
      renderCreatorDashboard();
    }
    await loadReaderLibrary();
    await initializeCreatorApplication();
  } catch {
    currentAccount = getSessionHint()
      ? { authenticated: true, ...getSessionHint(), unreadNotificationCount: getSessionHint().unread || 0 }
      : null;
    updateUserState();
    renderCreatorDashboard();
    await loadReaderLibrary();
    await initializeCreatorApplication();
  }
}

function getRequestedBookId() {
  const bookId = new URLSearchParams(window.location.search).get("book");
  return bookId && /^\d+$/.test(bookId) ? bookId : null;
}

function getReaderUrl(bookId) {
  return `reader.html?id=${encodeURIComponent(bookId)}`;
}

function setupReadingRequiredPrompt() {
  const parameters = new URLSearchParams(window.location.search);
  const requiresAccount = parameters.get("reason") === "read";
  const bookId = getRequestedBookId();

  if (readingRequiredNotice) {
    readingRequiredNotice.hidden = !requiresAccount;
  }

  if (requiredLoginLink && requiresAccount) {
    const loginParameters = new URLSearchParams({
      login: "1",
      reason: "read",
    });

    if (bookId) {
      loginParameters.set("book", bookId);
    }

    requiredLoginLink.href = `index.html?${loginParameters.toString()}#signin`;
  }

  if (modalSignupLink && requiresAccount && bookId) {
    const signupParameters = new URLSearchParams({
      reason: "read",
      book: bookId,
    });
    modalSignupLink.href = `signup.html?${signupParameters.toString()}`;
  }
}

function setSignInModal(open) {
  if (!signInModal) {
    return;
  }

  signInModal.classList.toggle("is-open", open);
  signInModal.setAttribute("aria-hidden", String(!open));

  if (open) {
    if (signInMessage) {
      signInMessage.textContent = "";
    }

    signInModal.querySelector("input")?.focus();
  } else {
    openSignIn?.focus();
  }
}

function getCollections() {
  return readerCollections;
}

async function loadReaderLibrary() {
  if (!currentAccount?.authenticated) {
    readerCollections = [];
    starredBooks = [];
    renderCollections();
    renderBookshelf();
    renderStarredBooks();
    if (collectionsGrid || bookshelf) window.location.href = "index.html?login=1";
    return;
  }
  try {
    const [collectionsResponse, starredResponse] = await Promise.all([
      fetch("/api/collections"), fetch("/api/starred"),
    ]);
    if (!collectionsResponse.ok || !starredResponse.ok) throw new Error("Your saved library could not be loaded.");
    readerCollections = (await collectionsResponse.json()).collections || [];
    starredBooks = (await starredResponse.json()).books || [];
    renderCollections();
    renderBookshelf();
    renderStarredBooks();
  } catch (error) {
    if (collectionMessage) collectionMessage.textContent = error.message;
  }
}

function setSaveBookModal(open, book = null, trigger = null) {
  if (!saveBookModal || !saveBookForm || !saveBookCollection) {
    return;
  }

  saveBookModal.classList.toggle("is-open", open);
  saveBookModal.setAttribute("aria-hidden", String(!open));

  if (!open) {
    saveBookForm.reset();
    saveBookMessage.textContent = "";
    bookBeingSaved = null;
    newCollectionField.hidden = true;
    saveBookTrigger?.focus();
    saveBookTrigger = null;
    return;
  }

  bookBeingSaved = book;
  saveBookTrigger = trigger;
  saveBookName.textContent = book.title;
  saveBookMessage.textContent = "";
  saveBookCollection.replaceChildren();

  getCollections().forEach((collection) => {
    const option = document.createElement("option");
    option.value = collection.id;
    option.textContent = collection.name;
    saveBookCollection.append(option);
  });

  const newOption = document.createElement("option");
  newOption.value = "__new__";
  newOption.textContent = "+ Create new collection";
  saveBookCollection.append(newOption);

  if (getCollections().length === 0) {
    saveBookCollection.value = "__new__";
  }

  newCollectionField.hidden = saveBookCollection.value !== "__new__";
  saveBookCollection.focus();
}

function namesMatch(firstName, secondName) {
  return firstName.trim().toLowerCase() === secondName.trim().toLowerCase();
}

function collectionNameExists(name, ignoredCollectionId = null) {
  return getCollections().some(
    (collection) =>
      collection.id !== ignoredCollectionId && namesMatch(collection.name, name)
  );
}

function setCollectionModal(open, mode = "create", collection = null) {
  if (!collectionModal || !collectionForm || !collectionNameInput) {
    return;
  }

  collectionModalMode = mode;
  collectionBeingRenamed = collection;
  collectionModal.classList.toggle("is-open", open);
  collectionModal.setAttribute("aria-hidden", String(!open));

  if (open) {
    const isRename = mode === "rename";
    collectionModalTitle.textContent = isRename
      ? "Rename collection"
      : "Create collection";
    collectionSubmitButton.textContent = isRename
      ? "Save name"
      : "Create collection";
    collectionNameInput.value = collection?.name || "";
    collectionMessage.textContent = "";
    collectionNameInput.focus();
    collectionNameInput.select();
    return;
  }

  collectionForm.reset();
  collectionMessage.textContent = "";
  collectionBeingRenamed = null;
  createCollectionButton?.focus();
}

function setDeleteCollectionModal(open, collection = null, trigger = null) {
  if (!deleteCollectionModal || !deleteCollectionWarning) {
    return;
  }

  deleteCollectionModal.classList.toggle("is-open", open);
  deleteCollectionModal.setAttribute("aria-hidden", String(!open));

  if (!open) {
    collectionBeingDeleted = null;
    deleteCollectionTrigger?.focus();
    deleteCollectionTrigger = null;
    return;
  }

  collectionBeingDeleted = collection;
  deleteCollectionTrigger = trigger;
  const bookCount = Array.isArray(collection.books)
    ? collection.books.length
    : 0;
  deleteCollectionWarning.textContent =
    `Deleting “${collection.name}” will also remove ` +
    `${bookCount} ${bookCount === 1 ? "saved book" : "saved books"} ` +
    "from this collection. This cannot be undone.";
  cancelDeleteCollection?.focus();
}

function createCollectionCard(collection) {
  const card = document.createElement("article");
  card.className = "collection-card";
  card.tabIndex = 0;
  card.setAttribute("role", "link");
  card.setAttribute("aria-label", `Open ${collection.name}`);

  const cover = document.createElement("div");
  cover.className = "collection-cover";
  cover.setAttribute("aria-hidden", "true");

  const title = document.createElement("h3");
  title.textContent = collection.name;

  let openTimer = null;

  const deleteButton = document.createElement("button");
  deleteButton.className = "delete-collection-button";
  deleteButton.type = "button";
  deleteButton.innerHTML = "&times;";
  deleteButton.setAttribute(
    "aria-label",
    `Delete collection ${collection.name}`
  );
  deleteButton.title = "Delete collection";
  deleteButton.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    clearTimeout(openTimer);
    setDeleteCollectionModal(true, collection, deleteButton);
  });

  const openCollection = () => {
    window.location.href = `collection.html?id=${encodeURIComponent(
      collection.id
    )}`;
  };

  card.addEventListener("click", (event) => {
    if (event.detail > 1) {
      clearTimeout(openTimer);
      return;
    }

    openTimer = setTimeout(openCollection, 220);
  });
  card.addEventListener("keydown", (event) => {
    if (event.target === card && event.key === "Enter") {
      openCollection();
    }
  });

  title.addEventListener("dblclick", (event) => {
    event.preventDefault();
    event.stopPropagation();
    clearTimeout(openTimer);
    setCollectionModal(true, "rename", collection);
  });

  card.append(deleteButton, cover, title);
  return card;
}

function renderCollections() {
  if (!collectionsGrid || !createCollectionButton) {
    return;
  }

  collectionsGrid
    .querySelectorAll(".collection-card")
    .forEach((card) => card.remove());

  getCollections().forEach((collection) => {
    collectionsGrid.insertBefore(
      createCollectionCard(collection),
      createCollectionButton
    );
  });
}

function renderBookshelf() {
  if (!bookshelf || !collectionTitle) {
    return;
  }

  const collectionId = new URLSearchParams(window.location.search).get("id");
  const collection = getCollections().find((item) => item.id === collectionId);

  if (!collection) {
    collectionTitle.textContent = "Collection not found";
    bookshelf.innerHTML =
      '<p class="empty-bookshelf">This collection could not be found.</p>';
    return;
  }

  collectionTitle.textContent = collection.name;
  collectionTitle.dataset.collectionId = collection.id;
  const books = collection.books || [];

  if (!books.length) {
    bookshelf.innerHTML =
      '<p class="empty-bookshelf">No books saved here yet.</p>';
    return;
  }

  bookshelf.innerHTML = "";
  books.forEach((book, bookIndex) => {
    const bookCard = document.createElement("article");
    bookCard.className = "book-spine-card";

    const removeButton = document.createElement("button");
    removeButton.className = "remove-book-button";
    removeButton.type = "button";
    removeButton.innerHTML = "&times;";
    removeButton.setAttribute(
      "aria-label",
      `Remove ${book.title} from ${collection.name}`
    );
    removeButton.title = "Remove from collection";
    removeButton.addEventListener("click", async () => {
      removeButton.disabled = true;
      const response = await fetch(
        `/api/collections/${collection.id}/books/${encodeURIComponent(book.id)}`,
        { method: "DELETE" }
      );
      if (!response.ok) { removeButton.disabled = false; return; }
      collection.books.splice(bookIndex, 1);
      collection.bookCount = collection.books.length;
      renderBookshelf();
    });

    const cover = document.createElement("div");
    cover.className = "book-cover";
    cover.style.setProperty("--book-color", book.color || "#20183f");

    if (book.cover_url) {
      const coverImage = document.createElement("img");
      coverImage.src = book.cover_url;
      coverImage.alt = "";
      cover.append(coverImage);
    }

    let coverElement = cover;

    if (book.id && book.has_file) {
      const coverLink = document.createElement("a");
      coverLink.className = "book-cover-link";
      coverLink.href = `reader.html?id=${encodeURIComponent(book.id)}`;
      coverLink.target = "_blank";
      coverLink.rel = "noopener";
      coverLink.setAttribute("aria-label", `Start reading ${book.title}`);
      coverLink.append(cover);
      coverElement = coverLink;
    }

    const title = document.createElement("h3");
    title.textContent = book.title;

    const author = document.createElement("p");
    author.textContent = book.author;

    bookCard.append(removeButton, coverElement, title, author);
    bookshelf.append(bookCard);
  });
}

function renderStarredBooks() {
  if (!starredGrid) return;
  starredGrid.replaceChildren();
  if (!starredBooks.length) {
    const empty = document.createElement("p");
    empty.className = "empty-bookshelf";
    empty.textContent = "No starred books yet.";
    starredGrid.append(empty);
    return;
  }
  starredBooks.forEach((book) => {
    const card = document.createElement("article");
    card.className = "book-spine-card";
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "remove-book-button";
    remove.innerHTML = "&times;";
    remove.setAttribute("aria-label", `Remove ${book.title} from starred books`);
    remove.addEventListener("click", async () => {
      const response = await fetch(`/api/starred/${encodeURIComponent(book.id)}`, { method: "DELETE" });
      if (response.ok) {
        starredBooks = starredBooks.filter((item) => String(item.id) !== String(book.id));
        renderStarredBooks();
        renderSearchResults();
      }
    });
    const cover = document.createElement("div");
    cover.className = "book-cover";
    if (book.cover_url) {
      const image = document.createElement("img");
      image.src = book.cover_url;
      image.alt = "";
      cover.append(image);
    }
    const coverElement = book.has_file ? document.createElement("a") : cover;
    if (book.has_file) {
      coverElement.className = "book-cover-link";
      coverElement.href = `reader.html?id=${encodeURIComponent(book.id)}`;
      coverElement.append(cover);
    }
    const title = document.createElement("h3");
    title.textContent = book.title;
    const author = document.createElement("p");
    author.textContent = book.author;
    card.append(remove, coverElement, title, author);
    starredGrid.append(card);
  });
}

openSignIn?.addEventListener("click", (event) => {
  event.preventDefault();
  setSignInModal(true);
});

closeSignIn?.addEventListener("click", () => setSignInModal(false));

createCollectionButton?.addEventListener("click", () => {
  setCollectionModal(true);
});

closeCollectionModal?.addEventListener("click", () => {
  setCollectionModal(false);
});

closeDeleteCollectionModal?.addEventListener("click", () => {
  setDeleteCollectionModal(false);
});

cancelDeleteCollection?.addEventListener("click", () => {
  setDeleteCollectionModal(false);
});

deleteCollectionModal?.addEventListener("click", (event) => {
  if (event.target === deleteCollectionModal) {
    setDeleteCollectionModal(false);
  }
});

confirmDeleteCollection?.addEventListener("click", async () => {
  if (!collectionBeingDeleted) {
    return;
  }

  const response = await fetch(`/api/collections/${collectionBeingDeleted.id}`, { method: "DELETE" });
  if (!response.ok) return;
  readerCollections = getCollections().filter((collection) => collection.id !== collectionBeingDeleted.id);
  setDeleteCollectionModal(false);
  renderCollections();
});

collectionTitle?.addEventListener("dblclick", () => {
  const collection = getCollections().find(
    (item) => item.id === collectionTitle.dataset.collectionId
  );

  if (collection) {
    setCollectionModal(true, "rename", collection);
  }
});

collectionModal?.addEventListener("click", (event) => {
  if (event.target === collectionModal) {
    setCollectionModal(false);
  }
});

collectionForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const name = collectionNameInput.value.trim();
  const renamedId =
    collectionModalMode === "rename" ? collectionBeingRenamed?.id : null;

  if (!name) {
    collectionMessage.textContent = "Please enter a collection name.";
    return;
  }

  if (collectionNameExists(name, renamedId)) {
    collectionMessage.textContent = "A collection with this name already exists.";
    return;
  }

  const renaming = collectionModalMode === "rename" && collectionBeingRenamed;
  const response = await fetch(renaming ? `/api/collections/${collectionBeingRenamed.id}` : "/api/collections", {
    method: renaming ? "PATCH" : "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    collectionMessage.textContent = result.error || "Collection could not be saved.";
    return;
  }
  if (renaming) {
    const index = readerCollections.findIndex((collection) => collection.id === result.collection.id);
    if (index >= 0) readerCollections[index] = result.collection;
  } else {
    readerCollections.unshift(result.collection);
  }

  renderCollections();
  renderBookshelf();
  setCollectionModal(false);
});

signInForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const formData = new FormData(signInForm);
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "").trim();
  const termsAccepted = formData.get("terms") === "on";

  if (!termsAccepted) {
    if (signInMessage) {
      signInMessage.textContent = "Please accept the Terms of Service.";
    }
    return;
  }

  try {
    const response = await fetch("/api/auth/sign-in/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (response.ok) {
      await initializeServerSession();
      setSignInModal(false);
      signInForm.reset();

      const requestedBookId = getRequestedBookId();
      if (requestedBookId) {
        window.location.href = getReaderUrl(requestedBookId);
      }
      return;
    }
    if (response.status === 403 && signInMessage) {
      signInMessage.textContent =
        "Please verify your email using the link we sent before logging in.";
      return;
    }
  } catch {
    // The message below intentionally does not reveal whether an account exists.
  }

  if (signInMessage) {
    signInMessage.textContent = "Email or password is incorrect.";
  }
});

signupForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!signupForm.checkValidity()) {
    signupForm.reportValidity();
    return;
  }

  const formData = new FormData(signupForm);
  const email = String(formData.get("email") || "").trim();
  const name = String(formData.get("name") || "").trim();
  const password = String(formData.get("password") || "");

  try {
    const response = await fetch("/api/auth/sign-up/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        email,
        password,
        callbackURL: `${window.location.origin}/email-verified`,
      }),
    });

    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      throw new Error(result.message || "Your account could not be created.");
    }

    await initializeServerSession();
  } catch (error) {
    let message = signupForm.querySelector(".signup-message");
    if (!message) {
      message = document.createElement("p");
      message.className = "signup-message signin-message";
      message.setAttribute("role", "status");
      signupForm.append(message);
    }
    message.textContent = error.message;
    return;
  }

  const requestedBookId = getRequestedBookId();
  window.location.href = requestedBookId
    ? getReaderUrl(requestedBookId)
    : "index.html";
});

logoutButton?.addEventListener("click", async () => {
  try {
    await fetch("/api/auth/sign-out", { method: "POST" });
  } catch {
    // The local display is still cleared if the server is unavailable.
  }
  currentAccount = null;
  localStorage.removeItem(sessionHintKey);
  userMenu?.classList.remove("is-open");
  userButton?.setAttribute("aria-expanded", "false");
  updateUserState();
  renderCreatorDashboard();
});

userButton?.addEventListener("click", () => {
  const isOpen = userMenu?.classList.toggle("is-open") || false;
  userButton.setAttribute("aria-expanded", String(isOpen));
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    setCollectionModal(false);
    setSaveBookModal(false);
    setDeleteCollectionModal(false);
    userMenu?.classList.remove("is-open");
    userButton?.setAttribute("aria-expanded", "false");
  }
});

document.addEventListener("click", (event) => {
  if (!userMenu?.contains(event.target)) {
    userMenu?.classList.remove("is-open");
    userButton?.setAttribute("aria-expanded", "false");
  }
});

document.querySelectorAll('a[href^="#"]').forEach((link) => {
  link.addEventListener("click", (event) => {
    if (link.dataset.modalOpen) {
      return;
    }

    const target = document.querySelector(link.getAttribute("href"));

    if (!target) {
      return;
    }

    event.preventDefault();
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  });
});

function createSearchResultCard(book) {
  const card = document.createElement("article");
  card.className = "search-result-card";

  const cover = document.createElement("div");
  cover.className = "search-result-cover";

  if (book.cover_url) {
    const image = document.createElement("img");
    image.src = book.cover_url;
    image.alt = `Cover of ${book.title}`;
    cover.append(image);
  } else {
    const placeholder = document.createElement("span");
    placeholder.textContent = book.title.slice(0, 1).toUpperCase();
    placeholder.setAttribute("aria-hidden", "true");
    cover.append(placeholder);
  }

  const details = document.createElement("div");
  details.className = "search-result-details";

  const title = document.createElement("h3");
  title.textContent = book.title;

  const metadata = document.createElement("dl");
  metadata.className = "search-result-metadata";

  const addMetadata = (label, value) => {
    if (!value) {
      return;
    }

    const term = document.createElement("dt");
    term.textContent = label;
    const description = document.createElement("dd");
    description.textContent = value;
    metadata.append(term, description);
  };

  addMetadata("Author", book.author);
  addMetadata("ISBN", book.isbn);
  addMetadata("DOI", book.doi);

  const description = document.createElement("p");
  description.className = "search-result-description";
  description.textContent =
    book.description || "No description is available for this book yet.";

  details.append(title, metadata, description);
  const actions = document.createElement("div");
  actions.className = "search-result-actions";

  if (book.has_file) {
    const readLink = document.createElement("a");
    readLink.className = "search-result-link";
    readLink.href = `reader.html?id=${encodeURIComponent(book.id)}`;
    readLink.target = "_blank";
    readLink.rel = "noopener";
    readLink.textContent = "Start reading";
    readLink.setAttribute("aria-label", `Start reading ${book.title}`);
    readLink.addEventListener("click", (event) => {
      if (currentAccount?.authenticated) {
        return;
      }

      event.preventDefault();
      const signupParameters = new URLSearchParams({
        reason: "read",
        book: String(book.id),
      });
      window.location.href = `signup.html?${signupParameters.toString()}`;
    });
    actions.append(readLink);
  } else {
    const unavailable = document.createElement("span");
    unavailable.className = "search-result-link is-unavailable";
    unavailable.textContent = "Start reading";
    actions.append(unavailable);
  }

  const collectionButton = document.createElement("button");
  collectionButton.className = "add-to-collection-button";
  collectionButton.type = "button";
  collectionButton.textContent = "Add to collection";
  collectionButton.setAttribute(
    "aria-label",
    `Add ${book.title} to a collection`
  );
  collectionButton.addEventListener("click", () => {
    if (!currentAccount?.authenticated) {
      window.location.href = "index.html?login=1";
      return;
    }
    setSaveBookModal(true, book, collectionButton);
  });
  const starButton = document.createElement("button");
  starButton.className = "star-book-button";
  starButton.type = "button";
  const refreshStar = () => {
    const starred = starredBooks.some((item) => String(item.id) === String(book.id));
    starButton.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 2.8 2.8 5.7 6.3.9-4.55 4.44 1.07 6.27L12 17.15l-5.62 2.96 1.07-6.27L2.9 9.4l6.3-.9L12 2.8Z"></path></svg>';
    starButton.classList.toggle("is-starred", starred);
    starButton.setAttribute("aria-label", starred ? `Remove ${book.title} from starred books` : `Star ${book.title}`);
    starButton.title = starred ? "Remove star" : "Star book";
    starButton.setAttribute("aria-pressed", String(starred));
  };
  refreshStar();
  starButton.addEventListener("click", async () => {
    if (!currentAccount?.authenticated) {
      window.location.href = "index.html?login=1";
      return;
    }
    const starred = starredBooks.some((item) => String(item.id) === String(book.id));
    starButton.disabled = true;
    const response = await fetch(`/api/starred/${encodeURIComponent(book.id)}`, {
      method: starred ? "DELETE" : "PUT",
    });
    if (response.ok) {
      if (starred) starredBooks = starredBooks.filter((item) => String(item.id) !== String(book.id));
      else starredBooks.unshift(book);
      refreshStar();
      renderStarredBooks();
    }
    starButton.disabled = false;
  });
  actions.append(collectionButton, starButton);
  details.append(actions);

  card.append(cover, details);
  return card;
}

function renderSearchResults() {
  if (!searchResultsGrid || !searchStatus || !searchResultsCount) {
    return;
  }

  const normalizedQuery = latestSearchQuery.toLowerCase();
  const scopedBooks = latestSearchBooks.filter((book) => {
    if (activeSearchScope === "title") {
      return String(book.title || "").toLowerCase().includes(normalizedQuery);
    }

    if (activeSearchScope === "author") {
      return String(book.author || "").toLowerCase().includes(normalizedQuery);
    }

    return true;
  });
  const visibleBooks = scopedBooks;

  searchResultsGrid.replaceChildren();
  searchStatus.textContent = visibleBooks.length
    ? ""
    : `No books found for “${latestSearchQuery}” in this category.`;
  searchResultsCount.textContent = `${visibleBooks.length.toLocaleString()} ${
    visibleBooks.length === 1 ? "TITLE" : "TITLES"
  } IN`;

  visibleBooks.forEach((book) => {
    searchResultsGrid.append(createSearchResultCard(book));
  });
}

async function searchBooks(query) {
  if (!searchResults || !searchResultsGrid || !searchStatus) {
    return;
  }

  searchResults.hidden = false;
  searchResultsGrid.replaceChildren();
  searchStatus.textContent = "Searching the nook...";
  searchResultsCount.textContent = "";
  latestSearchQuery = query;

  try {
    const response = await fetch(
      `/api/books/search?q=${encodeURIComponent(query)}`
    );

    if (!response.ok) {
      throw new Error("Search request failed");
    }

    latestSearchBooks = await response.json();
    renderSearchResults();
  } catch {
    searchStatus.textContent =
      "We couldn’t search right now. Make sure the server is running and try again.";
  }
}

bookSearchForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  const query = bookSearchInput.value.trim();

  if (!query) {
    bookSearchInput.focus();
    return;
  }

  runSearch(query);
});

searchResultTabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    activeSearchScope = tab.dataset.searchScope;

    searchResultTabs.forEach((currentTab) => {
      const isActive = currentTab === tab;
      currentTab.classList.toggle("is-active", isActive);
      currentTab.setAttribute("aria-pressed", String(isActive));
    });

    renderSearchResults();
  });
});

contactForm?.addEventListener("submit", (event) => {
  event.preventDefault();

  if (!contactForm.checkValidity()) {
    contactForm.reportValidity();
    return;
  }

  contactForm.reset();

  if (contactFormMessage) {
    contactFormMessage.textContent =
      "Thank you! Your form was submitted, but online delivery is not connected yet. For urgent help, email info@freebookery.org directly.";
  }
});

donorTypeOptions.forEach((option) => {
  option.addEventListener("change", () => {
    if (!option.checked || !donorTypeHeading || !donorTypeDescription) return;

    const isCorporate = option.value === "corporate";
    donorTypeHeading.textContent = isCorporate
      ? "Give as a corporate organization"
      : "Give as an individual";
    donorTypeDescription.textContent = isCorporate
      ? "Use the secure HCB form for your organization’s contribution. For employer matching or sponsorship arrangements, contact info@freebookery.org."
      : "Make a one-time or recurring contribution through the secure HCB donation form.";
  });
});

saveBookCollection?.addEventListener("change", () => {
  const creatingCollection = saveBookCollection.value === "__new__";
  newCollectionField.hidden = !creatingCollection;
  newCollectionInput.required = creatingCollection;

  if (creatingCollection) {
    newCollectionInput.focus();
  }
});

closeSaveBookModal?.addEventListener("click", () => {
  setSaveBookModal(false);
});

saveBookModal?.addEventListener("click", (event) => {
  if (event.target === saveBookModal) {
    setSaveBookModal(false);
  }
});

saveBookForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!bookBeingSaved) {
    return;
  }

  let collection = getCollections().find(
    (item) => item.id === saveBookCollection.value
  );

  if (saveBookCollection.value === "__new__") {
    const newName = newCollectionInput.value.trim();

    if (!newName) {
      saveBookMessage.textContent = "Enter a name for the new collection.";
      newCollectionInput.focus();
      return;
    }

    if (collectionNameExists(newName)) {
      saveBookMessage.textContent =
        "A collection with that name already exists.";
      newCollectionInput.focus();
      return;
    }

    const createResponse = await fetch("/api/collections", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName }),
    });
    const createResult = await createResponse.json().catch(() => ({}));
    if (!createResponse.ok) {
      saveBookMessage.textContent = createResult.error || "Collection could not be created.";
      return;
    }
    collection = createResult.collection;
    readerCollections.unshift(collection);
  }

  if (!collection) {
    saveBookMessage.textContent = "Choose a collection.";
    return;
  }

  const response = await fetch(
    `/api/collections/${collection.id}/books/${encodeURIComponent(bookBeingSaved.id)}`,
    { method: "PUT" }
  );
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    saveBookMessage.textContent = result.error || "Book could not be saved.";
    return;
  }
  if (!result.added) {
    saveBookMessage.textContent = `This book is already in ${collection.name}.`;
    return;
  }
  collection.books = Array.isArray(collection.books) ? collection.books : [];
  collection.books.unshift({ ...bookBeingSaved, status: "approved" });
  collection.bookCount = collection.books.length;
  setSaveBookModal(false);
});

function hasApprovedCreatorAccess() {
  return currentAccount?.role === "author" || currentAccount?.role === "admin";
}

function creatorApplicationIsEditable() {
  return ["draft", "changes_requested"].includes(
    creatorApplicationData?.application?.status
  );
}

function creatorStatusCopy(status) {
  return {
    draft: {
      title: "Your application is a draft",
      message: "Continue adding your author and first-book information when you are ready.",
      action: "Continue Application",
    },
    pending: {
      title: "Application under review",
      message: "Your Author application and first book are waiting for Admin review.",
    },
    changes_requested: {
      title: "Changes requested",
      message: "Review the Admin message, update your application, and submit it again.",
      action: "Review Requested Changes",
    },
    approved: {
      title: "Creator Access approved",
      message: "Your application has been approved. Refresh your session to open the Author workspace.",
    },
    rejected: {
      title: "Application not approved",
      message: "Review the Admin message below for more information.",
    },
  }[status];
}

function renderCreatorApplicationStatus() {
  if (!creatorApplicationStatus) return;
  creatorApplicationStatus.replaceChildren();

  const application = creatorApplicationData?.application;
  if (!currentAccount || hasApprovedCreatorAccess() || !application) {
    creatorApplicationStatus.hidden = true;
    return;
  }

  const copy = creatorStatusCopy(application.status);
  if (!copy) {
    creatorApplicationStatus.hidden = true;
    return;
  }

  const heading = document.createElement("h2");
  heading.textContent = copy.title;
  const description = document.createElement("p");
  description.textContent = copy.message;
  creatorApplicationStatus.append(heading, description);

  if (application.adminMessage) {
    const adminMessage = document.createElement("p");
    adminMessage.className = "creator-application-admin-message";
    adminMessage.textContent = `Admin message: ${application.adminMessage}`;
    creatorApplicationStatus.append(adminMessage);
  }

  if (copy.action && creatorApplicationIsEditable()) {
    const action = document.createElement("button");
    action.type = "button";
    action.textContent = copy.action;
    action.addEventListener("click", () => setCreatorTitleModal(true));
    creatorApplicationStatus.append(action);
  }

  creatorApplicationStatus.hidden = false;
}

async function initializeCreatorApplication() {
  if (!creatorPublicPage) return;
  creatorApplicationData = null;

  if (currentAccount && !hasApprovedCreatorAccess()) {
    try {
      const response = await fetch("/api/creator-applications/me");
      if (response.ok) creatorApplicationData = await response.json();
    } catch {
      // The public page remains usable when the API is unavailable.
    }
  } else if (currentAccount && hasApprovedCreatorAccess()) {
    try {
      const response = await fetch("/api/author/books");
      if (response.ok) creatorBooks = (await response.json()).books || [];
    } catch {
      creatorBooks = [];
    }
  }

  renderCreatorApplicationStatus();
  renderCreatorDashboard();
}

async function ensureCreatorApplication() {
  if (creatorApplicationData?.application) return creatorApplicationData;
  const response = await fetch("/api/creator-applications", { method: "POST" });
  if (!response.ok) throw new Error("Your application could not be started.");
  creatorApplicationData = await response.json();
  renderCreatorApplicationStatus();
  return creatorApplicationData;
}

function renderCreatorDashboard() {
  if (!creatorPublicPage || !creatorDashboard) return;

  const approved = hasApprovedCreatorAccess();
  creatorPublicPage.hidden = approved;
  creatorDashboard.hidden = !approved;
  renderCreatorApplicationStatus();

  if (!approved || !creatorTitleGrid || !creatorEmptyLibrary) return;

  const titles = creatorBooks;
  creatorTitleGrid.replaceChildren();
  creatorEmptyLibrary.hidden = titles.length > 0;

  const titleCount = document.querySelector("[data-creator-title-count]");
  const liveCount = document.querySelector("[data-creator-live-count]");
  const reviewCount = document.querySelector("[data-creator-review-count]");

  if (titleCount) titleCount.textContent = String(titles.length);
  if (liveCount) {
    liveCount.textContent = String(
      titles.filter((title) => title.status === "approved").length
    );
  }
  if (reviewCount) {
    reviewCount.textContent = String(
      titles.filter((title) => title.status === "pending").length
    );
  }

  titles.forEach((title) => {
    const card = document.createElement("article");
    card.className = "creator-title-card";

    const cover = document.createElement("div");
    cover.className = "creator-title-cover";
    cover.textContent = (title.title || "Untitled")
      .split(/\s+/)
      .slice(0, 2)
      .map((word) => word[0])
      .join("")
      .toUpperCase();

    const heading = document.createElement("h3");
    heading.textContent = title.title || "Untitled draft";

    const author = document.createElement("p");
    author.textContent = title.author || "Author not added";

    const status = document.createElement("span");
    status.className = "creator-title-status";
    if (title.status === "pending") status.classList.add("is-review");
    status.textContent = ({
      draft: "Draft", pending: "Under review", changes_requested: "Changes requested",
      approved: "Live", rejected: "Not approved", unpublished: "Unpublished",
    })[title.status] || title.status;

    if (["draft", "changes_requested"].includes(title.status)) {
      card.tabIndex = 0;
      card.setAttribute("role", "button");
      card.addEventListener("click", () => {
        activeCreatorBook = title;
        setCreatorTitleModal(true);
      });
    }

    if (title.adminMessage) {
      const note = document.createElement("p");
      note.textContent = `Admin message: ${title.adminMessage}`;
      card.append(cover, heading, author, status, note);
    } else {
      card.append(cover, heading, author, status);
    }

    const actions = document.createElement("div");
    actions.className = "creator-title-actions";
    const addAction = (label, endpoint, method = "POST") => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = label;
      button.addEventListener("click", async (event) => {
        event.stopPropagation();
        if (label === "Delete" && !confirm("Delete this book draft and its private files?")) return;
        const response = await fetch(`/api/author/books/${title.id}${endpoint}`, { method });
        if (!response.ok) {
          const result = await response.json().catch(() => ({}));
          alert(result.error || "The book could not be updated.");
          return;
        }
        if (method === "DELETE") creatorBooks = creatorBooks.filter((book) => book.id !== title.id);
        else {
          const updated = (await response.json()).book;
          const index = creatorBooks.findIndex((book) => book.id === title.id);
          if (index >= 0) creatorBooks[index] = updated;
        }
        renderCreatorDashboard();
      });
      actions.append(button);
    };
    if (["draft", "changes_requested", "rejected"].includes(title.status)) addAction("Delete", "", "DELETE");
    if (title.status === "pending") addAction("Withdraw", "/withdraw");
    if (title.status === "approved") addAction("Unpublish", "/unpublish");
    if (actions.childElementCount) card.append(actions);
    creatorTitleGrid.append(card);
  });
}

function updateCreatorFormStep(step) {
  if (!creatorTitleForm) return;
  creatorFormStep = Math.min(3, Math.max(1, step));

  creatorTitleForm.querySelectorAll("[data-creator-step]").forEach((panel) => {
    panel.hidden = Number(panel.dataset.creatorStep) !== creatorFormStep;
  });

  document.querySelectorAll("[data-creator-step-indicator]").forEach((item) => {
    const itemStep = Number(item.dataset.creatorStepIndicator);
    item.classList.toggle("is-active", itemStep === creatorFormStep);
    item.classList.toggle("is-complete", itemStep < creatorFormStep);
  });

  if (creatorBackButton) creatorBackButton.hidden = creatorFormStep === 1;
  if (creatorNextButton) creatorNextButton.hidden = creatorFormStep === 3;
  if (creatorSubmitButton) creatorSubmitButton.hidden = creatorFormStep !== 3;

  if (creatorFormStep === 3) renderCreatorReview();
  if (creatorFormMessage) creatorFormMessage.textContent = "";
}

function setCreatorTitleModal(open) {
  if (!creatorTitleModal || !creatorTitleForm) return;
  creatorTitleModal.hidden = !open;
  creatorTitleModal.setAttribute("aria-hidden", String(!open));
  document.body.style.overflow = open ? "hidden" : "";

  if (open) {
    const laterBook = hasApprovedCreatorAccess();
    const title = document.querySelector("#creator-form-title");
    if (title) title.textContent = laterBook ? "Submit a book" : "Author application & first book";
    ["creatorType", "legalName", "penName", "website", "biography", "verificationDetails"].forEach((name) => {
      const field = creatorTitleForm.elements.namedItem(name);
      if (field && !(field instanceof RadioNodeList)) field.disabled = laterBook;
    });
    populateCreatorForm();
    updateCreatorFormStep(1);
    creatorTitleForm.querySelector("input, select")?.focus();
  } else {
    updateCreatorFormStep(1);
  }
}

function setCreatorField(name, value) {
  const field = creatorTitleForm?.elements.namedItem(name);
  if (!field) return;
  if (field instanceof RadioNodeList) {
    field.value = value;
  } else if (field.type === "checkbox") {
    field.checked = Boolean(value);
  } else {
    field.value = value ?? "";
  }
}

function populateCreatorForm() {
  if (!creatorTitleForm) return;
  creatorTitleForm.reset();
  const application = creatorApplicationData?.application;
  const book = hasApprovedCreatorAccess() ? activeCreatorBook : creatorApplicationData?.book;
  if (!book) return;

  if (application) {
    setCreatorField("creatorType", application.creatorType);
    setCreatorField("legalName", application.legalName);
    setCreatorField("penName", application.penName);
    setCreatorField("biography", application.biography);
    setCreatorField("website", application.website);
    setCreatorField("verificationDetails", application.verificationDetails);
  }
  setCreatorField("rights", application ? application.rightsConfirmation : book.rightsConfirmation);
  setCreatorField("title", book.title);
  setCreatorField("subtitle", book.subtitle);
  setCreatorField("language", book.language);
  setCreatorField("isbn", book.isbn);
  setCreatorField("series", book.series);
  setCreatorField("edition", book.edition);
  setCreatorField("author", book.author);
  setCreatorField("contributors", book.contributors);
  setCreatorField("description", book.description);
  setCreatorField("categories", book.categories);
  setCreatorField("keywords", book.keywords);
  setCreatorField("readingAge", book.readingAge);
  setCreatorField("explicit", book.explicit ? "yes" : "no");
  setCreatorField("territories", book.territories);
  setCreatorField("accessibility", book.accessibility);

  renderExistingCreatorFile("manuscript", book.manuscript);
  renderExistingCreatorFile("cover", book.cover);
}

function formatFileSize(bytes) {
  if (!Number.isFinite(Number(bytes))) return "";
  const size = Number(bytes);
  return size >= 1024 * 1024
    ? `${(size / (1024 * 1024)).toFixed(1)} MB`
    : `${Math.max(1, Math.round(size / 1024))} KB`;
}

function renderExistingCreatorFile(kind, file) {
  const container = document.querySelector(`[data-creator-existing-${kind}]`);
  if (!container) return;
  container.replaceChildren();
  if (!file) {
    container.textContent = "No file uploaded yet.";
    return;
  }
  const link = document.createElement("a");
  link.href = file.url;
  link.target = "_blank";
  link.rel = "noopener";
  link.textContent = `${file.name} (${formatFileSize(file.size)})`;
  const remove = document.createElement("button");
  remove.type = "button";
  remove.textContent = "Remove";
  remove.addEventListener("click", async () => {
    const response = await fetch(file.url, { method: "DELETE" });
    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      creatorFormMessage.textContent = result.error || "File could not be removed.";
      return;
    }
    if (hasApprovedCreatorAccess() && activeCreatorBook) activeCreatorBook[kind] = null;
    else if (creatorApplicationData?.book) creatorApplicationData.book[kind] = null;
    renderExistingCreatorFile(kind, null);
    creatorFormMessage.textContent = "File removed.";
  });
  container.append(link, document.createTextNode(" "), remove);
}

function uploadContentType(file, kind) {
  if (kind === "manuscript" && file.name.toLowerCase().endsWith(".epub")) {
    return "application/epub+zip";
  }
  return file.type;
}

async function uploadCreatorFiles(recordId) {
  const uploads = [
    ["manuscript", creatorTitleForm.elements.manuscript.files[0], 95 * 1024 * 1024],
    ["cover", creatorTitleForm.elements.cover.files[0], 10 * 1024 * 1024],
  ];
  for (const [kind, file, limit] of uploads) {
    if (!file) continue;
    if (file.size > limit) throw new Error(`${kind === "cover" ? "Cover" : "Book file"} is too large.`);
    const response = await fetch(
      hasApprovedCreatorAccess()
        ? `/api/author/books/${recordId}/files/${kind}`
        : `/api/creator-applications/${recordId}/files/${kind}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": uploadContentType(file, kind),
          "X-File-Name": encodeURIComponent(file.name),
        },
        body: file,
      }
    );
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || `${kind} upload failed.`);
  }
  const refreshed = await fetch(hasApprovedCreatorAccess()
    ? `/api/author/books/${recordId}` : "/api/creator-applications/me");
  if (refreshed.ok) {
    const data = await refreshed.json();
    if (hasApprovedCreatorAccess()) activeCreatorBook = data.book;
    else creatorApplicationData = data;
  }
}

function creatorStepIsValid() {
  if (!creatorTitleForm) return false;
  const currentPanel = creatorTitleForm.querySelector(
    `[data-creator-step="${creatorFormStep}"]`
  );
  const fields = currentPanel?.querySelectorAll("input, select, textarea") || [];

  for (const field of fields) {
    if (!field.checkValidity()) {
      field.reportValidity();
      return false;
    }
  }
  return true;
}

function getCreatorFormData() {
  const formData = new FormData(creatorTitleForm);
  const manuscript = formData.get("manuscript");
  const cover = formData.get("cover");

  return {
    application: {
      creatorType: String(formData.get("creatorType") || "author"),
      legalName: String(formData.get("legalName") || "").trim(),
      penName: String(formData.get("penName") || "").trim(),
      biography: String(formData.get("biography") || "").trim(),
      website: String(formData.get("website") || "").trim(),
      verificationDetails: String(
        formData.get("verificationDetails") || ""
      ).trim(),
      rightsConfirmation: formData.get("rights") === "on",
    },
    book: {
      title: String(formData.get("title") || "").trim(),
      subtitle: String(formData.get("subtitle") || "").trim(),
      author: String(formData.get("author") || "").trim(),
      language: String(formData.get("language") || "English"),
      isbn: String(formData.get("isbn") || "").trim(),
      series: String(formData.get("series") || "").trim(),
      edition: String(formData.get("edition") || "").trim(),
      contributors: String(formData.get("contributors") || "").trim(),
      description: String(formData.get("description") || "").trim(),
      categories: String(formData.get("categories") || "").trim(),
      keywords: String(formData.get("keywords") || "").trim(),
      readingAge: String(formData.get("readingAge") || "").trim(),
      explicit: String(formData.get("explicit") || "no") === "yes",
      territories: String(formData.get("territories") || "Worldwide"),
      accessibility: String(formData.get("accessibility") || "").trim(),
      rightsConfirmation: formData.get("rights") === "on",
      manuscriptName: manuscript?.name || activeCreatorBook?.manuscript?.name || creatorApplicationData?.book?.manuscript?.name || "",
      coverName: cover?.name || activeCreatorBook?.cover?.name || creatorApplicationData?.book?.cover?.name || "",
    },
  };
}

function renderCreatorReview() {
  if (!creatorReview || !creatorTitleForm) return;
  const data = getCreatorFormData();
  const title = data.book;
  const reviewItems = [
    ["Applicant", hasApprovedCreatorAccess() ? (currentAccount?.name || "Author") : (data.application.legalName || "Not added")],
    ["Submission", hasApprovedCreatorAccess() ? "New book" : data.application.creatorType],
    ["Title", title.title || "Not added"],
    ["Author", title.author || "Not added"],
    ["Language", title.language],
    ["ISBN", title.isbn || "Not provided"],
    ["Category", title.categories || "Not added"],
    ["Availability", title.territories],
    ["Book file", title.manuscriptName || "Not uploaded"],
    ["Cover", title.coverName || "Not uploaded"],
  ];

  creatorReview.replaceChildren();
  reviewItems.forEach(([label, value]) => {
    const item = document.createElement("div");
    const name = document.createElement("span");
    const content = document.createElement("strong");
    name.textContent = label;
    content.textContent = value;
    item.append(name, content);
    creatorReview.append(item);
  });
}

document.querySelectorAll("[data-creator-title-open]").forEach((button) => {
  button.addEventListener("click", async () => {
    if (!hasApprovedCreatorAccess()) return setCreatorTitleModal(true);
    try {
      const response = await fetch("/api/author/books", { method: "POST" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "A new draft could not be started.");
      activeCreatorBook = result.book;
      creatorBooks.unshift(result.book);
      renderCreatorDashboard();
      setCreatorTitleModal(true);
    } catch (error) {
      if (creatorApplicationStatus) {
        creatorApplicationStatus.hidden = false;
        creatorApplicationStatus.textContent = error.message;
      }
    }
  });
});

document
  .querySelector("[data-creator-title-close]")
  ?.addEventListener("click", () => setCreatorTitleModal(false));

creatorTitleModal?.addEventListener("click", (event) => {
  if (event.target === creatorTitleModal) setCreatorTitleModal(false);
});

creatorApplicationOpenButtons.forEach((button) => {
  button.addEventListener("click", async () => {
    if (!currentAccount) {
      window.location.href = "index.html?login=1";
      return;
    }
    if (hasApprovedCreatorAccess()) return;

    try {
      await ensureCreatorApplication();
      if (creatorApplicationIsEditable()) setCreatorTitleModal(true);
    } catch (error) {
      if (creatorApplicationStatus) {
        creatorApplicationStatus.hidden = false;
        creatorApplicationStatus.textContent = error.message;
      }
    }
  });
});

creatorNextButton?.addEventListener("click", () => {
  if (creatorStepIsValid()) updateCreatorFormStep(creatorFormStep + 1);
});

creatorBackButton?.addEventListener("click", () => {
  updateCreatorFormStep(creatorFormStep - 1);
});

creatorDraftButton?.addEventListener("click", async () => {
  try {
    if (hasApprovedCreatorAccess()) {
      if (!activeCreatorBook) throw new Error("Start a book draft first.");
      const response = await fetch(`/api/author/books/${activeCreatorBook.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ book: getCreatorFormData().book }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Draft could not be saved.");
      activeCreatorBook = result.book;
      await uploadCreatorFiles(activeCreatorBook.id);
      const index = creatorBooks.findIndex((book) => book.id === activeCreatorBook.id);
      if (index >= 0) creatorBooks[index] = activeCreatorBook;
      creatorFormMessage.textContent = "Draft saved online.";
      populateCreatorForm();
      renderCreatorDashboard();
      return;
    }
    await ensureCreatorApplication();
    const response = await fetch(
      `/api/creator-applications/${creatorApplicationData.application.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(getCreatorFormData()),
      }
    );
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Draft could not be saved.");
    creatorApplicationData = result;
    await uploadCreatorFiles(creatorApplicationData.application.id);
    creatorFormMessage.textContent = "Draft saved.";
    populateCreatorForm();
    renderCreatorApplicationStatus();
  } catch (error) {
    creatorFormMessage.textContent = error.message;
  }
});

creatorTitleForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!creatorStepIsValid()) return;

  try {
    if (hasApprovedCreatorAccess()) {
      if (!activeCreatorBook) throw new Error("Start a book draft first.");
      const bookId = activeCreatorBook.id;
      const saveResponse = await fetch(`/api/author/books/${bookId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ book: getCreatorFormData().book }),
      });
      const saveResult = await saveResponse.json();
      if (!saveResponse.ok) throw new Error(saveResult.error || "Book could not be saved.");
      activeCreatorBook = saveResult.book;
      await uploadCreatorFiles(bookId);
      const submitResponse = await fetch(`/api/author/books/${bookId}/submit`, { method: "POST" });
      const submitResult = await submitResponse.json();
      if (!submitResponse.ok) throw new Error(submitResult.error || "Book could not be submitted.");
      activeCreatorBook = submitResult.book;
      const index = creatorBooks.findIndex((book) => book.id === bookId);
      if (index >= 0) creatorBooks[index] = activeCreatorBook;
      setCreatorTitleModal(false);
      renderCreatorDashboard();
      return;
    }
    await ensureCreatorApplication();
    const applicationId = creatorApplicationData.application.id;
    const saveResponse = await fetch(`/api/creator-applications/${applicationId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(getCreatorFormData()),
    });
    const saveResult = await saveResponse.json();
    if (!saveResponse.ok) {
      throw new Error(saveResult.error || "Application could not be saved.");
    }

    creatorApplicationData = saveResult;
    await uploadCreatorFiles(applicationId);

    const submitResponse = await fetch(
      `/api/creator-applications/${applicationId}/submit`,
      { method: "POST" }
    );
    const submitResult = await submitResponse.json();
    if (!submitResponse.ok) {
      throw new Error(submitResult.error || "Application could not be submitted.");
    }

    creatorApplicationData = submitResult;
    setCreatorTitleModal(false);
    renderCreatorApplicationStatus();
  } catch (error) {
    creatorFormMessage.textContent = error.message;
  }
});

updateUserState();
renderCollections();
renderBookshelf();
renderRecentSearches();
renderCreatorDashboard();
initializeServerSession();
setupReadingRequiredPrompt();
setupBlogPostPreviews();

const initialSearchQuery = new URLSearchParams(window.location.search).get(
  "query"
);
if (bookSearchInput && initialSearchQuery) {
  runSearch(initialSearchQuery);
}

if (
  signInModal &&
  new URLSearchParams(window.location.search).get("login") === "1"
) {
  setSignInModal(true);

  if (signInMessage) {
    signInMessage.textContent = "Log in to start reading this book.";
  }
}
