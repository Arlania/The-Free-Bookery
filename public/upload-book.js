async function loadUploadWorkspace() {
  const host = document.querySelector("[data-upload-workspace]");
  const loading = document.querySelector("[data-upload-loading]");

  try {
    const response = await fetch("creator-access.html", {
      headers: { Accept: "text/html" },
    });
    if (!response.ok) throw new Error("Upload workspace could not be loaded.");

    const source = new DOMParser().parseFromString(await response.text(), "text/html");
    const dashboard = source.querySelector("[data-creator-dashboard]");
    const modal = source.querySelector("[data-creator-title-modal]");
    if (!dashboard || !modal) throw new Error("Upload workspace is unavailable.");

    dashboard.querySelector(".creator-eyebrow").textContent = "Owner & Admin workspace";
    dashboard.querySelector("h1").textContent = "Upload Book";
    dashboard.querySelector(".creator-dashboard-header p:last-child").textContent =
      "Upload new books, continue drafts, and follow each title through review and publication.";
    dashboard.querySelector("#creator-library-title").textContent = "Uploaded titles";
    dashboard.querySelector(".creator-add-title").lastChild.textContent = " Upload a book";
    modal.querySelector("#creator-form-title").textContent = "Upload a book";

    host.append(dashboard, modal);
    loading.remove();

    const applicationScript = document.createElement("script");
    applicationScript.src = "script.js";
    document.body.append(applicationScript);
  } catch (error) {
    loading.className = "admin-upload-message";
    loading.textContent = error.message;
  }
}

loadUploadWorkspace();
