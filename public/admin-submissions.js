const list = document.querySelector("[data-admin-list]");
const detail = document.querySelector("[data-admin-detail]");
const message = document.querySelector("[data-admin-message]");
const workspace = document.querySelector("[data-admin-workspace]");
const tabs = Array.from(document.querySelectorAll("[data-admin-tab]"));
const authorCount = document.querySelector("[data-author-count]");
const bookCount = document.querySelector("[data-book-count]");
const decisionDialog = document.querySelector("[data-admin-decision-dialog]");
const decisionForm = document.querySelector("[data-admin-decision-form]");
const decisionTitle = document.querySelector("[data-admin-decision-title]");
const decisionEyebrow = document.querySelector("[data-admin-decision-eyebrow]");
const decisionHelp = document.querySelector("[data-admin-decision-help]");
const decisionMessage = document.querySelector("[data-admin-decision-message]");
const decisionStatus = document.querySelector("[data-admin-decision-status]");
const decisionConfirm = document.querySelector("[data-admin-decision-confirm]");

let submissions = { authors: [], books: [] };
let activeTab = "authors";
let selectedId = null;
let pendingDecision = null;

function valueOrFallback(value) {
  return value === true ? "Yes" : value === false ? "No" : String(value || "Not provided");
}

function detailSection(title, rows) {
  const section = document.createElement("section");
  section.className = "admin-review-section";
  const heading = document.createElement("h2");
  heading.textContent = title;
  const grid = document.createElement("dl");
  grid.className = "admin-review-grid";
  rows.forEach(([label, value, wide = false]) => {
    const item = document.createElement("div");
    if (wide) item.className = "is-wide";
    const term = document.createElement("dt");
    term.textContent = label;
    const description = document.createElement("dd");
    description.textContent = valueOrFallback(value);
    item.append(term, description);
    grid.append(item);
  });
  section.append(heading, grid);
  return section;
}

function currentItems() {
  return submissions[activeTab];
}

function renderTabs() {
  authorCount.textContent = submissions.authors.length;
  bookCount.textContent = submissions.books.length;
  tabs.forEach((tab) => {
    const active = tab.dataset.adminTab === activeTab;
    tab.classList.toggle("is-active", active);
    tab.setAttribute("aria-pressed", String(active));
  });
}

function renderList() {
  const items = currentItems();
  list.replaceChildren();
  list.setAttribute("aria-label", activeTab === "authors" ? "Pending Author applications" : "Pending book submissions");
  if (!items.length) {
    const empty = document.createElement("div");
    empty.className = "admin-list-empty";
    empty.innerHTML = `<strong>All clear</strong><span>No pending ${activeTab === "authors" ? "Author applications" : "book submissions"}.</span>`;
    list.append(empty);
    detail.innerHTML = '<div class="admin-submission-empty">Nothing is waiting for review in this section.</div>';
    return;
  }
  items.forEach((submission) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "admin-submission-list-item";
    button.classList.toggle("is-active", submission.id === selectedId);
    const eyebrow = document.createElement("small");
    eyebrow.textContent = activeTab === "authors" ? "AUTHOR APPLICATION" : "BOOK SUBMISSION";
    const title = document.createElement("strong");
    title.textContent = activeTab === "authors"
      ? submission.applicant.legalName || submission.applicant.accountName
      : submission.book.title || "Untitled book";
    const subtitle = document.createElement("span");
    subtitle.textContent = activeTab === "authors"
      ? submission.applicant.email
      : `${submission.book.author || "Unknown author"} · ${submission.applicant.accountName}`;
    const date = document.createElement("time");
    date.textContent = submission.submittedAt ? new Date(`${submission.submittedAt}Z`).toLocaleString() : "Pending";
    button.append(eyebrow, title, subtitle, date);
    button.addEventListener("click", () => {
      selectedId = submission.id;
      renderList();
      renderDetail(submission);
    });
    list.append(button);
  });
}

function fileCard(label, file, image = false) {
  const card = document.createElement("a");
  card.className = "admin-review-file";
  if (!file) {
    card.removeAttribute("href");
    card.classList.add("is-missing");
    card.textContent = `${label} not provided`;
    return card;
  }
  card.href = file.url;
  card.target = "_blank";
  card.rel = "noopener";
  if (image) {
    const preview = document.createElement("img");
    preview.src = file.url;
    preview.alt = "Submitted book cover";
    card.append(preview);
  }
  const content = document.createElement("span");
  const name = document.createElement("strong");
  name.textContent = label;
  const meta = document.createElement("small");
  meta.textContent = `${file.name} · ${Math.max(1, Math.round(file.size / 1024))} KB`;
  content.append(name, meta);
  card.append(content);
  return card;
}

function closeDecisionDialog() {
  if (decisionDialog?.open) decisionDialog.close();
  pendingDecision = null;
  decisionForm?.reset();
  if (decisionStatus) decisionStatus.textContent = "";
}

function openDecisionDialog(submission, decision) {
  const isAuthor = submission.kind === "author";
  const target = isAuthor ? "Author" : "Book";
  pendingDecision = { submission, decision };
  decisionForm.reset();
  decisionStatus.textContent = "";
  decisionEyebrow.textContent = `${target} decision`;
  decisionTitle.textContent = `${decision === "approve" ? "Approve" : "Reject"} ${target}`;
  decisionHelp.textContent = decision === "reject" ? "Required for rejection" : "Optional for approval";
  decisionMessage.required = decision === "reject";
  decisionConfirm.textContent = decision === "approve" ? `Approve ${target}` : `Reject ${target}`;
  decisionConfirm.classList.toggle("is-reject", decision === "reject");
  decisionDialog.showModal();
  decisionMessage.focus();
}

function reviewActions(submission) {
  const isAuthor = submission.kind === "author";
  const container = document.createElement("section");
  container.className = "admin-review-form";
  if (!isAuthor && !submission.canApprove) {
    const warning = document.createElement("div");
    warning.className = "admin-review-warning";
    warning.textContent = "This book cannot be approved until its Author application is approved.";
    container.append(warning);
  }
  const actions = document.createElement("div");
  actions.className = "admin-review-actions";
  [
    ["approve", isAuthor ? "Approve Author" : "Approve Book", "is-approve"],
    ["reject", isAuthor ? "Reject Author" : "Reject Book", "is-reject"],
  ].forEach(([value, text, className]) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = text;
    button.className = className;
    if (value === "approve" && !isAuthor && !submission.canApprove) button.disabled = true;
    button.addEventListener("click", () => openDecisionDialog(submission, value));
    actions.append(button);
  });
  container.append(actions);
  return container;
}

function renderDetail(submission) {
  detail.replaceChildren();
  if (submission.kind === "author") {
    const intro = document.createElement("header");
    intro.className = "admin-review-detail-heading";
    intro.innerHTML = `<span>AUTHOR APPLICATION</span><h2></h2>`;
    intro.querySelector("h2").textContent = submission.applicant.legalName || submission.applicant.accountName;
    detail.append(
      intro,
      detailSection("Applicant", [
        ["Account", submission.applicant.accountName], ["Email", submission.applicant.email],
        ["Applying as", submission.applicant.creatorType], ["Pen name", submission.applicant.penName],
        ["Website", submission.applicant.website], ["Rights confirmed", submission.applicant.rightsConfirmation],
        ["Biography", submission.applicant.biography, true],
        ["Verification details", submission.applicant.verificationDetails, true],
      ]),
      reviewActions(submission)
    );
    return;
  }

  const book = submission.book;
  const intro = document.createElement("header");
  intro.className = "admin-review-detail-heading";
  intro.innerHTML = '<span>BOOK SUBMISSION</span><h2></h2><p></p>';
  intro.querySelector("h2").textContent = book.title || "Untitled book";
  intro.querySelector("p").textContent = `Submitted by ${submission.applicant.accountName} (${submission.applicant.email})`;
  const files = document.createElement("section");
  files.className = "admin-review-section";
  files.innerHTML = "<h2>Files</h2>";
  const fileGrid = document.createElement("div");
  fileGrid.className = "admin-review-files";
  fileGrid.append(fileCard("Cover", book.cover, true), fileCard("Book file", book.manuscript));
  files.append(fileGrid);
  detail.append(
    intro,
    detailSection("Book details", [
      ["Author", book.author], ["Subtitle", book.subtitle], ["Language", book.language],
      ["ISBN", book.isbn], ["DOI", book.doi], ["Series", book.series],
      ["Edition", book.edition], ["Contributors", book.contributors],
      ["Genres", book.categories], ["Availability", book.territories],
      ["Accessibility", book.accessibility], ["简介 / Description", book.description, true],
    ]),
    files,
    reviewActions(submission)
  );
}

decisionForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!pendingDecision) return;
  const { submission, decision } = pendingDecision;
  const applicantMessage = decisionMessage.value.trim();
  if (decision === "reject" && !applicantMessage) {
    decisionMessage.setCustomValidity("Write a message explaining the rejection.");
    decisionMessage.reportValidity();
    return;
  }
  decisionMessage.setCustomValidity("");
  decisionConfirm.disabled = true;
  decisionStatus.textContent = "Saving decision…";
  try {
    const collection = submission.kind === "author" ? "authors" : "books";
    const response = await fetch(`/api/admin/submissions/${collection}/${submission.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision, message: applicantMessage }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Decision could not be saved.");
    closeDecisionDialog();
    await loadSubmissions(`${submission.kind === "author" ? "Author" : "Book"} ${decision === "approve" ? "approved" : "rejected"}.`);
  } catch (error) {
    decisionStatus.textContent = error.message;
  } finally {
    decisionConfirm.disabled = false;
  }
});

decisionMessage?.addEventListener("input", () => decisionMessage.setCustomValidity(""));
document.querySelectorAll("[data-admin-decision-close], [data-admin-decision-cancel]").forEach((button) => {
  button.addEventListener("click", closeDecisionDialog);
});
decisionDialog?.addEventListener("click", (event) => {
  if (event.target === decisionDialog) closeDecisionDialog();
});
decisionDialog?.addEventListener("cancel", (event) => {
  event.preventDefault();
  closeDecisionDialog();
});

async function loadSubmissions(successMessage = "") {
  message.textContent = successMessage || "Loading submissions…";
  try {
    const accountResponse = await fetch("/api/account");
    if (accountResponse.status === 401) return void (location.href = "index.html?login=1");
    const account = await accountResponse.json();
    if (!accountResponse.ok || (account.accountRole !== "owner" && account.role !== "admin")) {
      message.textContent = "Owner or Admin access is required.";
      return;
    }
    const response = await fetch("/api/admin/submissions");
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Submissions could not be loaded.");
    submissions = {
      authors: result.authorApplications || [],
      books: result.bookSubmissions || [],
    };
    const items = currentItems();
    selectedId = items.some((item) => item.id === selectedId) ? selectedId : items[0]?.id || null;
    workspace.hidden = false;
    renderTabs();
    renderList();
    if (selectedId) renderDetail(items.find((item) => item.id === selectedId));
    if (!successMessage) message.textContent = `${submissions.authors.length} Author application${submissions.authors.length === 1 ? "" : "s"} and ${submissions.books.length} book submission${submissions.books.length === 1 ? "" : "s"} pending.`;
  } catch (error) {
    message.textContent = error.message;
  }
}

tabs.forEach((tab) => tab.addEventListener("click", () => {
  activeTab = tab.dataset.adminTab;
  selectedId = currentItems()[0]?.id || null;
  renderTabs();
  renderList();
  if (selectedId) renderDetail(currentItems()[0]);
}));
document.querySelector("[data-admin-refresh]")?.addEventListener("click", () => loadSubmissions());
loadSubmissions();
