const list = document.querySelector("[data-admin-list]");
const detail = document.querySelector("[data-admin-detail]");
const message = document.querySelector("[data-admin-message]");
const workspace = document.querySelector("[data-admin-workspace]");
let submissions = [];
let selectedId = null;

function text(tag, label, value) {
  const element = document.createElement(tag);
  if (label) {
    const strong = document.createElement("strong");
    strong.textContent = `${label}: `;
    element.append(strong);
  }
  element.append(document.createTextNode(value || "Not provided"));
  return element;
}

function renderList() {
  list.replaceChildren();
  if (!submissions.length) {
    list.append(text("p", "", "No pending Creator applications."));
    detail.innerHTML = '<div class="admin-submission-empty">New applications will appear here.</div>';
    return;
  }
  submissions.forEach((submission) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "admin-submission-list-item";
    button.classList.toggle("is-active", submission.id === selectedId);
    const title = document.createElement("strong");
    title.textContent = submission.book?.title || "Untitled book";
    const applicant = document.createElement("span");
    applicant.textContent = submission.kind === "book"
      ? `${submission.applicant.legalName} · New book`
      : `${submission.applicant.legalName} · Creator application`;
    const date = document.createElement("small");
    date.textContent = submission.submittedAt || "Pending";
    button.append(title, applicant, date);
    button.addEventListener("click", () => {
      selectedId = submission.id;
      renderList();
      renderDetail(submission);
    });
    list.append(button);
  });
}

function section(title, rows) {
  const container = document.createElement("section");
  const heading = document.createElement("h2");
  heading.textContent = title;
  container.append(heading);
  rows.forEach(([label, value]) => container.append(text("p", label, String(value || ""))));
  return container;
}

function renderDetail(submission) {
  detail.replaceChildren();
  const applicant = submission.applicant;
  const book = submission.book || {};
  const applicantRows = [
      ["Legal name", applicant.legalName], ["Account", applicant.accountName],
      ["Email", applicant.email], ["Submission type", submission.kind === "book" ? "New book" : "Creator application"],
      ["Applying as", applicant.creatorType],
      ["Rights confirmed", applicant.rightsConfirmation ? "Yes" : "No"],
  ];
  if (submission.kind !== "book") applicantRows.push(
    ["Pen name", applicant.penName], ["Website", applicant.website],
    ["Biography", applicant.biography], ["Verification", applicant.verificationDetails]
  );
  detail.append(
    section("Applicant", applicantRows),
    section(submission.kind === "book" ? "Book" : "First book", [
      ["Title", book.title], ["Subtitle", book.subtitle], ["Author", book.author],
      ["Language", book.language], ["ISBN", book.isbn], ["Series", book.series],
      ["Edition", book.edition], ["Contributors", book.contributors],
      ["Description", book.description], ["Categories", book.categories],
      ["Keywords", book.keywords], ["Reading age", book.readingAge],
      ["Explicit content", book.explicit ? "Yes" : "No"],
      ["Territories", book.territories], ["Accessibility", book.accessibility],
    ])
  );

  const files = document.createElement("section");
  const filesHeading = document.createElement("h2");
  filesHeading.textContent = "Private files";
  files.append(filesHeading);
  [["Manuscript", book.manuscript], ["Cover", book.cover]].forEach(([label, file]) => {
    const row = document.createElement("p");
    const strong = document.createElement("strong");
    strong.textContent = `${label}: `;
    row.append(strong);
    if (file) {
      const link = document.createElement("a");
      link.href = file.url;
      link.target = "_blank";
      link.rel = "noopener";
      link.textContent = `${file.name} (${Math.max(1, Math.round(file.size / 1024))} KB)`;
      row.append(link);
    } else {
      row.append(document.createTextNode("Not uploaded"));
    }
    files.append(row);
  });
  detail.append(files);

  const form = document.createElement("form");
  form.className = "admin-review-form";
  form.innerHTML = `
    <label>Message to applicant <span>Required for changes or rejection</span>
      <textarea name="message" rows="5" maxlength="2000"></textarea>
    </label>
    <p role="status" aria-live="polite"></p>
    <div>
      <button type="submit" name="decision" value="approve" class="is-approve">Approve</button>
      <button type="submit" name="decision" value="request_changes">Request changes</button>
      <button type="submit" name="decision" value="reject" class="is-reject">Reject</button>
    </div>`;
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const decision = event.submitter?.value;
    const status = form.querySelector("p");
    const buttons = form.querySelectorAll("button");
    buttons.forEach((button) => { button.disabled = true; });
    status.textContent = "Saving decision…";
    try {
      const response = await fetch(`/api/admin/submissions/${submission.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, message: form.elements.message.value.trim() }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Decision could not be saved.");
      submissions = submissions.filter((item) => item.id !== submission.id);
      selectedId = submissions[0]?.id || null;
      renderList();
      if (selectedId) renderDetail(submissions[0]);
      message.textContent = "Review decision saved.";
    } catch (error) {
      status.textContent = error.message;
      buttons.forEach((button) => { button.disabled = false; });
    }
  });
  detail.append(form);
}

async function loadSubmissions() {
  message.textContent = "Loading submissions…";
  try {
    const accountResponse = await fetch("/api/account");
    if (accountResponse.status === 401) {
      location.href = "index.html?login=1";
      return;
    }
    const account = await accountResponse.json();
    if (!accountResponse.ok || account.role !== "admin") {
      message.textContent = "Admin access is required.";
      return;
    }
    const response = await fetch("/api/admin/submissions");
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Submissions could not be loaded.");
    submissions = result.submissions;
    selectedId = submissions[0]?.id || null;
    workspace.hidden = false;
    message.textContent = `${submissions.length} pending submission${submissions.length === 1 ? "" : "s"}.`;
    renderList();
    if (selectedId) renderDetail(submissions[0]);
  } catch (error) {
    message.textContent = error.message;
  }
}

document.querySelector("[data-admin-refresh]")?.addEventListener("click", loadSubmissions);
loadSubmissions();
