import { getDocument, GlobalWorkerOptions } from "/vendor/pdfjs/pdf.mjs";

GlobalWorkerOptions.workerSrc = "/vendor/pdfjs/pdf.worker.mjs";

const title = document.querySelector("#reader-title");
const author = document.querySelector(".reader-author");
const message = document.querySelector(".reader-message");
const stage = document.querySelector(".reader-stage");
const canvas = document.querySelector(".reader-canvas");
const epubStage = document.querySelector(".reader-epub");
const context = canvas.getContext("2d");
const previousButton = document.querySelector(".reader-previous");
const nextButton = document.querySelector(".reader-next");
const fullscreenButton = document.querySelector(".reader-fullscreen");
const pageInput = document.querySelector(".reader-page-number input");
const pageTotal = document.querySelector(".reader-page-total");

let format = "pdf";
let pdf = null;
let currentPage = 1;
let renderTask = null;
let epubBook = null;
let rendition = null;
let epubLocation = null;
let resizeTimer = null;

function updateControls() {
  if (format === "pdf") {
    pageInput.value = currentPage;
    pageInput.max = pdf?.numPages || 1;
    pageTotal.textContent = pdf?.numPages || "—";
    previousButton.disabled = !pdf || currentPage <= 1;
    nextButton.disabled = !pdf || currentPage >= pdf.numPages;
    return;
  }

  const percentage = epubLocation?.start?.percentage;
  pageInput.value = Number.isFinite(percentage)
    ? String(Math.max(1, Math.round(percentage * 100)))
    : "1";
  pageInput.max = 100;
  pageTotal.textContent = "100%";
  previousButton.disabled = !rendition || Boolean(epubLocation?.atStart);
  nextButton.disabled = !rendition || Boolean(epubLocation?.atEnd);
}

async function renderPdfPage() {
  if (!pdf) return;
  if (renderTask) {
    renderTask.cancel();
    renderTask = null;
  }

  const page = await pdf.getPage(currentPage);
  const baseViewport = page.getViewport({ scale: 1 });
  const availableWidth = Math.max(stage.clientWidth - 32, 240);
  const availableHeight = Math.max(stage.clientHeight - 32, 320);
  const displayScale = Math.min(
    availableWidth / baseViewport.width,
    availableHeight / baseViewport.height
  );
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  const viewport = page.getViewport({ scale: displayScale * pixelRatio });

  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  canvas.style.width = `${Math.floor(viewport.width / pixelRatio)}px`;
  canvas.style.height = `${Math.floor(viewport.height / pixelRatio)}px`;
  canvas.hidden = false;
  message.textContent = "";
  renderTask = page.render({ canvasContext: context, viewport });

  try {
    await renderTask.promise;
  } catch (error) {
    if (error?.name !== "RenderingCancelledException") throw error;
  } finally {
    renderTask = null;
  }
  updateControls();
}

async function goToPosition(position) {
  if (format === "pdf") {
    if (!pdf) return;
    currentPage = Math.min(Math.max(position, 1), pdf.numPages);
    await renderPdfPage();
    return;
  }
  if (!rendition) return;
  const percentage = Math.min(Math.max(position, 1), 100) / 100;
  const cfi = epubBook.locations.cfiFromPercentage(percentage);
  if (cfi) await rendition.display(cfi);
}

function secureEpubContents(contents) {
  const document = contents.document;
  const policy = document.createElement("meta");
  policy.httpEquiv = "Content-Security-Policy";
  policy.content = "default-src 'none'; img-src blob: data:; media-src blob: data:; style-src 'unsafe-inline' blob:; font-src blob: data:";
  document.head?.prepend(policy);
  document.querySelectorAll("script, iframe, object, embed, form").forEach((element) => element.remove());
  document.querySelectorAll("*").forEach((element) => {
    for (const attribute of [...element.attributes]) {
      if (attribute.name.toLowerCase().startsWith("on")) element.removeAttribute(attribute.name);
    }
  });
}

async function loadEpub(bookId) {
  if (typeof window.ePub !== "function") throw new Error("EPUB reader unavailable");
  const response = await fetch(`/api/books/${encodeURIComponent(bookId)}/read`);
  if (!response.ok) throw new Error("EPUB request failed");
  epubBook = window.ePub(await response.arrayBuffer());
  await epubBook.ready;
  if (!epubBook.spine?.spineItems?.length) throw new Error("EPUB has no readable chapters");

  epubStage.hidden = false;
  canvas.hidden = true;
  rendition = epubBook.renderTo(epubStage, {
    width: "100%",
    height: "100%",
    spread: "none",
    allowScriptedContent: false,
  });
  rendition.hooks.content.register(secureEpubContents);
  rendition.on("relocated", (location) => {
    epubLocation = location;
    if (location?.start?.cfi && epubBook.locations?.length()) {
      epubLocation.start.percentage = epubBook.locations.percentageFromCfi(location.start.cfi);
    }
    updateControls();
  });
  await rendition.display();
  await epubBook.locations.generate(1600);
  const location = rendition.currentLocation();
  if (location?.start?.cfi) {
    location.start.percentage = epubBook.locations.percentageFromCfi(location.start.cfi);
    epubLocation = location;
  }
  message.textContent = "";
  updateControls();
}

async function loadBook() {
  const bookId = new URLSearchParams(window.location.search).get("id");
  if (!bookId || !/^[0-9a-f-]{1,100}$/i.test(bookId)) {
    title.textContent = "Book unavailable";
    message.textContent = "Return to search and choose a book to read.";
    return;
  }

  const accountResponse = await fetch("/api/account");
  if (!accountResponse.ok) {
    const parameters = new URLSearchParams({ reason: "read", book: bookId });
    window.location.replace(`signup.html?${parameters}`);
    return;
  }

  try {
    const response = await fetch(`/api/books/${encodeURIComponent(bookId)}`);
    if (!response.ok) throw new Error("Book request failed");
    const book = await response.json();
    title.textContent = book.title;
    author.textContent = `by ${book.author}`;
    document.title = `${book.title} | Free Bookery`;
    if (!book.has_file) {
      message.textContent = "The digital copy of this book is not available.";
      return;
    }

    format = book.format;
    if (format === "epub") {
      await loadEpub(book.id);
    } else {
      pdf = await getDocument({ url: `/api/books/${encodeURIComponent(book.id)}/read` }).promise;
      updateControls();
      await renderPdfPage();
    }
  } catch (error) {
    console.error("Book reader failed", error);
    title.textContent = "Book unavailable";
    message.textContent = "We couldn’t open this book. The file may be missing or invalid.";
  }
}

previousButton.addEventListener("click", () => {
  if (format === "epub") rendition?.prev();
  else goToPosition(currentPage - 1);
});
nextButton.addEventListener("click", () => {
  if (format === "epub") rendition?.next();
  else goToPosition(currentPage + 1);
});
pageInput.addEventListener("change", () => {
  goToPosition(Number.parseInt(pageInput.value, 10) || (format === "pdf" ? currentPage : 1));
});

fullscreenButton.addEventListener("click", async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch {
    message.textContent = "Full screen is not available in this browser window.";
  }
});

document.addEventListener("keydown", (event) => {
  if (event.target === pageInput) return;
  if (event.key === "ArrowLeft" || event.key === "PageUp") previousButton.click();
  if (event.key === "ArrowRight" || event.key === "PageDown") nextButton.click();
});

document.addEventListener("fullscreenchange", () => {
  const isFullscreen = Boolean(document.fullscreenElement);
  const label = isFullscreen ? "Exit full screen" : "Enter full screen";
  fullscreenButton.setAttribute("aria-label", label);
  fullscreenButton.title = label;
  fullscreenButton.setAttribute("aria-pressed", String(isFullscreen));
  fullscreenButton.classList.toggle("is-fullscreen", isFullscreen);
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => format === "pdf" ? renderPdfPage() : rendition?.resize(), 150);
});

window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => format === "pdf" ? renderPdfPage() : rendition?.resize(), 150);
});

updateControls();
if (!document.fullscreenEnabled) {
  fullscreenButton.disabled = true;
  fullscreenButton.setAttribute("aria-label", "Full screen is not available in this browser");
  fullscreenButton.title = "Full screen is not available in this browser";
}
loadBook();
