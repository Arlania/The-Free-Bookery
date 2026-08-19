import {
  getDocument,
  GlobalWorkerOptions,
} from "/vendor/pdfjs/pdf.mjs";

GlobalWorkerOptions.workerSrc = "/vendor/pdfjs/pdf.worker.mjs";

const title = document.querySelector("#reader-title");
const author = document.querySelector(".reader-author");
const message = document.querySelector(".reader-message");
const stage = document.querySelector(".reader-stage");
const canvas = document.querySelector(".reader-canvas");
const context = canvas.getContext("2d");
const previousButton = document.querySelector(".reader-previous");
const nextButton = document.querySelector(".reader-next");
const fullscreenButton = document.querySelector(".reader-fullscreen");
const pageInput = document.querySelector(".reader-page-number input");
const pageTotal = document.querySelector(".reader-page-total");

let pdf = null;
let currentPage = 1;
let renderTask = null;
let resizeTimer = null;

function updateControls() {
  pageInput.value = currentPage;
  pageInput.max = pdf?.numPages || 1;
  pageTotal.textContent = pdf?.numPages || "—";
  previousButton.disabled = !pdf || currentPage <= 1;
  nextButton.disabled = !pdf || currentPage >= pdf.numPages;
}

async function renderPage() {
  if (!pdf) {
    return;
  }

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
  const renderViewport = page.getViewport({
    scale: displayScale * pixelRatio,
  });

  canvas.width = Math.floor(renderViewport.width);
  canvas.height = Math.floor(renderViewport.height);
  canvas.style.width = `${Math.floor(renderViewport.width / pixelRatio)}px`;
  canvas.style.height = `${Math.floor(renderViewport.height / pixelRatio)}px`;
  canvas.hidden = false;
  message.textContent = "";

  renderTask = page.render({
    canvasContext: context,
    viewport: renderViewport,
  });

  try {
    await renderTask.promise;
  } catch (error) {
    if (error?.name !== "RenderingCancelledException") {
      throw error;
    }
  } finally {
    renderTask = null;
  }

  updateControls();
}

async function goToPage(pageNumber) {
  if (!pdf) {
    return;
  }

  currentPage = Math.min(Math.max(pageNumber, 1), pdf.numPages);
  await renderPage();
}

async function loadBook() {
  const bookId = new URLSearchParams(window.location.search).get("id");

  if (!bookId || !/^\d+$/.test(bookId)) {
    title.textContent = "Book unavailable";
    message.textContent = "Return to search and choose a book to read.";
    return;
  }

  const accountResponse = await fetch("/api/account");
  if (!accountResponse.ok) {
    const signupParameters = new URLSearchParams({
      reason: "read",
      book: bookId,
    });
    window.location.replace(`signup.html?${signupParameters.toString()}`);
    return;
  }

  try {
    const response = await fetch(`/api/books/${encodeURIComponent(bookId)}`);

    if (!response.ok) {
      throw new Error("Book request failed");
    }

    const book = await response.json();
    title.textContent = book.title;
    author.textContent = `by ${book.author}`;
    document.title = `${book.title} | Free Bookery`;

    if (!book.has_file) {
      message.textContent = "The digital copy of this book is not available.";
      return;
    }

    pdf = await getDocument({
      url: `/api/books/${encodeURIComponent(book.id)}/read`,
    }).promise;
    updateControls();
    await renderPage();
  } catch {
    title.textContent = "Book unavailable";
    message.textContent =
      "We couldn’t load this book. Make sure the server is running and try again.";
  }
}

previousButton.addEventListener("click", () => goToPage(currentPage - 1));
nextButton.addEventListener("click", () => goToPage(currentPage + 1));
fullscreenButton.addEventListener("click", async () => {
  try {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await document.documentElement.requestFullscreen();
    }
  } catch {
    message.textContent =
      "Full screen is not available in this browser window.";
  }
});
pageInput.addEventListener("change", () => {
  goToPage(Number.parseInt(pageInput.value, 10) || currentPage);
});

document.addEventListener("keydown", (event) => {
  if (event.target === pageInput) {
    return;
  }

  if (event.key === "ArrowLeft" || event.key === "PageUp") {
    goToPage(currentPage - 1);
  }

  if (event.key === "ArrowRight" || event.key === "PageDown") {
    goToPage(currentPage + 1);
  }
});

document.addEventListener("fullscreenchange", () => {
  const isFullscreen = Boolean(document.fullscreenElement);
  const fullscreenLabel = isFullscreen
    ? "Exit full screen"
    : "Enter full screen";
  fullscreenButton.setAttribute("aria-label", fullscreenLabel);
  fullscreenButton.title = fullscreenLabel;
  fullscreenButton.setAttribute("aria-pressed", String(isFullscreen));
  fullscreenButton.classList.toggle("is-fullscreen", isFullscreen);

  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(renderPage, 150);
});

window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(renderPage, 150);
});

updateControls();

if (!document.fullscreenEnabled) {
  fullscreenButton.disabled = true;
  const unavailableLabel = "Full screen is not available in this browser";
  fullscreenButton.setAttribute("aria-label", unavailableLabel);
  fullscreenButton.title = unavailableLabel;
}

loadBook();
