const form = document.querySelector("[data-auth-flow-form]");
const message = document.querySelector("[data-auth-flow-message]");

document.querySelectorAll('input[type="password"]').forEach((passwordInput) => {
  const passwordField = document.createElement("div");
  passwordField.className = "password-field";
  passwordInput.before(passwordField);
  passwordField.append(passwordInput);

  const toggle = document.createElement("button");
  toggle.className = "password-visibility-toggle";
  toggle.type = "button";
  const updateToggle = (showing) => {
    toggle.setAttribute("aria-label", showing ? "Hide password" : "Show password");
    toggle.setAttribute("aria-pressed", String(showing));
    toggle.title = showing ? "Hide password" : "Show password";
    toggle.innerHTML = showing
      ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"></path><circle cx="12" cy="12" r="2.75"></circle><path d="m4 4 16 16"></path></svg>'
      : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"></path><circle cx="12" cy="12" r="2.75"></circle></svg>';
  };
  updateToggle(false);
  toggle.addEventListener("click", () => {
    const showing = passwordInput.type !== "text";
    passwordInput.type = showing ? "text" : "password";
    updateToggle(showing);
    passwordInput.focus();
  });
  passwordField.append(toggle);
});

function setMessage(text, isError = false) {
  message.textContent = text;
  message.classList.toggle("is-error", isError);
}

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }

  const data = new FormData(form);
  const flow = form.dataset.authFlowForm;
  const submitButton = form.querySelector('button[type="submit"]');
  submitButton.disabled = true;

  try {
    if (flow === "forgot-password") {
      await fetch("/api/auth/request-password-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: String(data.get("email") || "").trim(),
          redirectTo: `${window.location.origin}/reset-password`,
        }),
      });
      form.reset();
      setMessage(
        "If an account exists for that email, a password-reset link has been sent."
      );
      return;
    }

    const token = new URLSearchParams(window.location.search).get("token");
    if (!token) throw new Error("This password-reset link is invalid or expired.");

    const password = String(data.get("password") || "");
    const confirmation = String(data.get("password-confirmation") || "");
    if (password !== confirmation) throw new Error("The passwords do not match.");

    const response = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newPassword: password, token }),
    });
    if (!response.ok) throw new Error("This password-reset link is invalid or expired.");

    form.reset();
    setMessage("Your password has been reset. You can now log in.");
  } catch (error) {
    setMessage(error.message || "The request could not be completed.", true);
  } finally {
    submitButton.disabled = false;
  }
});
