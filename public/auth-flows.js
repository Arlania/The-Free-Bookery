const form = document.querySelector("[data-auth-flow-form]");
const message = document.querySelector("[data-auth-flow-message]");

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
