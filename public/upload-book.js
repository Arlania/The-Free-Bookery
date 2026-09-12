const uploadForm = document.querySelector("[data-admin-book-upload]");
const accessMessage = document.querySelector("[data-admin-upload-access]");
const uploadStatus = document.querySelector("[data-admin-book-upload-status]");
const uploadSubmit = uploadForm?.querySelector('button[type="submit"]');

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
  const data = new FormData(uploadForm);
  const manuscript = data.get("manuscript");
  const cover = data.get("cover");

  if (!(manuscript instanceof File) || !manuscript.size || !(cover instanceof File) || !cover.size) {
    uploadStatus.textContent = "Choose both a book file and a cover image.";
    return;
  }
  if (manuscript.size > 95 * 1024 * 1024) {
    uploadStatus.textContent = "The book file must be 95 MB or smaller.";
    return;
  }
  if (cover.size > 10 * 1024 * 1024) {
    uploadStatus.textContent = "The cover image must be 10 MB or smaller.";
    return;
  }

  let bookId = null;
  uploadSubmit.disabled = true;
  uploadStatus.textContent = "Creating book draft…";

  try {
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
          author: data.get("author"),
          contributors: data.get("contributors"),
          description: data.get("description"),
          categories: data.get("categories"),
          language: data.get("language"),
          isbn: data.get("isbn"),
          doi: data.get("doi"),
          territories: data.get("territories"),
          accessibility: data.get("accessibility"),
          rightsConfirmation: data.get("rights") === "on",
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
