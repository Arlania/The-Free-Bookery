const uploadForm = document.querySelector("[data-admin-book-upload]");
const accessMessage = document.querySelector("[data-admin-upload-access]");
const uploadStatus = document.querySelector("[data-admin-book-upload-status]");
const uploadSubmit = uploadForm?.querySelector('button[type="submit"]');
const contributorList = document.querySelector("[data-admin-contributors]");
const addContributorButton = document.querySelector("[data-admin-add-contributor]");
const genreInputs = Array.from(document.querySelectorAll('[data-admin-genres] input[name="genre"]'));
const genreCount = document.querySelector("[data-admin-genre-count]");
const otherGenreChoice = document.querySelector("[data-admin-other-genre-choice]");
const otherGenreField = document.querySelector("[data-admin-other-genre]");
const otherGenreInput = uploadForm?.elements.namedItem("otherGenre");

function addContributor() {
  if (!contributorList || contributorList.childElementCount >= 9) return;
  const row = document.createElement("div");
  row.className = "creator-contributor-row";
  row.innerHTML = `
    <label>Role<select data-contributor-role><option>Author</option><option>Editor</option><option>Illustrator</option><option>Translator</option><option>Other</option></select></label>
    <label>First name<input type="text" data-contributor-first></label>
    <label>Last name<input type="text" data-contributor-last></label>
    <button type="button" aria-label="Remove contributor">Remove</button>
    <label class="creator-contributor-role-other" data-contributor-other-field hidden>Specify role<input type="text" maxlength="80" data-contributor-other-role></label>`;
  const role = row.querySelector("[data-contributor-role]");
  const customField = row.querySelector("[data-contributor-other-field]");
  const customInput = row.querySelector("[data-contributor-other-role]");
  const updateRole = () => {
    const custom = role.value === "Other";
    customField.hidden = !custom;
    customInput.required = custom;
    if (!custom) customInput.value = "";
  };
  role.addEventListener("change", updateRole);
  row.querySelector("button").addEventListener("click", () => row.remove());
  updateRole();
  contributorList.append(row);
}

function contributorValue() {
  return Array.from(contributorList?.children || []).map((row) => {
    const selectedRole = row.querySelector("[data-contributor-role]").value;
    const role = selectedRole === "Other"
      ? row.querySelector("[data-contributor-other-role]").value.trim()
      : selectedRole;
    const name = [row.querySelector("[data-contributor-first]").value, row.querySelector("[data-contributor-last]").value]
      .map((part) => part.trim()).filter(Boolean).join(" ");
    return name ? `${role}: ${name}` : "";
  }).filter(Boolean).join("; ");
}

function updateGenres() {
  const selected = genreInputs.filter((input) => input.checked);
  genreInputs.forEach((input) => { input.disabled = selected.length >= 3 && !input.checked; });
  const custom = Boolean(otherGenreChoice?.checked);
  otherGenreField.hidden = !custom;
  otherGenreInput.disabled = !custom;
  otherGenreInput.required = custom;
  if (!custom) otherGenreInput.value = "";
  genreCount.textContent = `${selected.length} of 3 selected`;
  genreInputs[0]?.setCustomValidity(selected.length ? "" : "Choose at least one book genre.");
}

function genreValue() {
  return genreInputs.filter((input) => input.checked).map((input) =>
    input.value === "Other" ? otherGenreInput.value.trim() : input.value
  ).filter(Boolean).join(", ");
}

addContributorButton?.addEventListener("click", addContributor);
genreInputs.forEach((input) => input.addEventListener("change", updateGenres));
updateGenres();

function fileContentType(file, kind) {
  if (kind === "manuscript") {
    return file.name.toLowerCase().endsWith(".epub")
      ? "application/epub+zip"
      : "application/pdf";
  }
  return file.type === "image/png" ? "image/png" : "image/jpeg";
}

async function requestJson(url, options) {
  const response = await fetch(url, options);
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || "The book could not be uploaded.");
  return result;
}

async function uploadFile(bookId, kind, file) {
  return requestJson(`/api/author/books/${bookId}/files/${kind}`, {
    method: "PUT",
    headers: {
      "Content-Type": fileContentType(file, kind),
      "X-File-Name": encodeURIComponent(file.name),
    },
    body: file,
  });
}

async function initializeUploadAccess() {
  try {
    const response = await fetch("/api/account", { headers: { Accept: "application/json" } });
    const account = response.ok ? await response.json() : null;
    const allowed = account?.accountRole === "owner" || account?.role === "admin";
    uploadForm.hidden = !allowed;
    accessMessage.hidden = allowed;
    if (!allowed) {
      accessMessage.textContent = account
        ? "Owner or Admin access is required to upload books."
        : "Sign in with an Owner or Admin account to upload books.";
    }
  } catch {
    uploadForm.hidden = true;
    accessMessage.hidden = false;
    accessMessage.textContent = "Access could not be verified. Please refresh and try again.";
  }
}

uploadForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  updateGenres();
  if (!genreInputs.some((input) => input.checked)) {
    genreInputs[0]?.reportValidity();
    return;
  }
  const data = new FormData(uploadForm);
  const manuscript = data.get("manuscript");
  let cover = data.get("cover");

  if (!(manuscript instanceof File) || !manuscript.size) {
    uploadStatus.textContent = "Choose a PDF or EPUB book file.";
    return;
  }
  if (manuscript.size > 95 * 1024 * 1024) {
    uploadStatus.textContent = "The book file must be 95 MB or smaller.";
    return;
  }
  if (cover instanceof File && cover.size > 10 * 1024 * 1024) {
    uploadStatus.textContent = "The cover image must be 10 MB or smaller.";
    return;
  }

  let bookId = null;
  uploadSubmit.disabled = true;
  uploadStatus.textContent = "Creating book draft…";

  try {
    if (!(cover instanceof File) || !cover.size) {
      uploadStatus.textContent = "Creating a cover…";
      cover = await window.FreeBookeryCover.create(manuscript, data.get("title"));
    }
    const created = await requestJson("/api/author/books", { method: "POST" });
    bookId = created.book.id;

    uploadStatus.textContent = "Saving book details…";
    await requestJson(`/api/author/books/${bookId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        book: {
          title: data.get("title"),
          subtitle: data.get("subtitle"),
          author: [data.get("authorFirstName"), data.get("authorLastName")]
            .map((part) => String(part || "").trim()).filter(Boolean).join(" "),
          contributors: contributorValue(),
          description: data.get("description"),
          categories: genreValue(),
          language: data.get("language"),
          isbn: data.get("isbn"),
          doi: data.get("doi"),
          series: data.get("series"),
          edition: data.get("edition"),
          territories: data.get("territories"),
          accessibility: data.get("accessibility"),
          rightsConfirmation: Boolean(data.get("rights")),
        },
      }),
    });

    uploadStatus.textContent = "Uploading book file…";
    await uploadFile(bookId, "manuscript", manuscript);
    uploadStatus.textContent = "Uploading cover image…";
    await uploadFile(bookId, "cover", cover);
    uploadStatus.textContent = "Publishing book…";
    const published = await requestJson(`/api/admin/books/${bookId}/publish`, { method: "POST" });

    uploadForm.reset();
    uploadForm.elements.language.value = "English";
    contributorList.replaceChildren();
    updateGenres();
    uploadStatus.replaceChildren(
      document.createTextNode(`“${published.book.title}” is now live. `),
      Object.assign(document.createElement("a"), {
        href: `search.html?query=${encodeURIComponent(published.book.title)}`,
        textContent: "View in catalog",
      })
    );
    bookId = null;
  } catch (error) {
    uploadStatus.textContent = error.message;
    if (bookId) {
      await fetch(`/api/author/books/${bookId}`, { method: "DELETE" }).catch(() => null);
    }
  } finally {
    uploadSubmit.disabled = false;
  }
});

initializeUploadAccess();
