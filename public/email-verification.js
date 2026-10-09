const pendingCard = document.querySelector("[data-verification-pending]");
const resultCard = document.querySelector("[data-verification-result]");
let pendingEmail = "";
try {
  pendingEmail = sessionStorage.getItem("freeBookeryPendingVerificationEmail") || "";
} catch {
  // The instructions remain useful when private browsing blocks storage.
}
const parameters = new URLSearchParams(window.location.search);
const requestedBookId = parameters.get("book");
const validBookId = requestedBookId && /^\d+$/.test(requestedBookId)
  ? requestedBookId
  : "";
const verificationCallback = `${window.location.origin}/email-verified.html${
  validBookId ? `?book=${encodeURIComponent(validBookId)}` : ""
}`;

if (pendingCard) {
  const emailLabel = pendingCard.querySelector("[data-pending-email]");
  if (emailLabel && pendingEmail) emailLabel.textContent = ` to ${pendingEmail}`;

  const resendButton = pendingCard.querySelector("[data-resend-verification]");
  const status = pendingCard.querySelector("[data-verification-status]");

  if (!pendingEmail) {
    resendButton.hidden = true;
  }

  resendButton?.addEventListener("click", async () => {
    resendButton.disabled = true;
    status.textContent = "Sending…";

    try {
      const response = await fetch("/api/auth/send-verification-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: pendingEmail, callbackURL: verificationCallback }),
      });
      if (!response.ok) throw new Error("The verification email could not be resent.");
      status.textContent = "A new verification email has been sent.";
    } catch (error) {
      status.textContent = error.message || "The verification email could not be resent.";
    } finally {
      resendButton.disabled = false;
    }
  });
}

if (resultCard) {
  const title = resultCard.querySelector("h1");
  const message = resultCard.querySelector("[data-verification-message]");
  const action = resultCard.querySelector("[data-verification-action]");
  const icon = resultCard.querySelector(".verification-icon");
  const verificationError = parameters.get("error");

  if (verificationError) {
    resultCard.classList.add("verification-error");
    icon.textContent = "!";
    title.textContent = "Verification link expired";
    message.textContent = "This link is invalid or has expired. Log in to request a new verification email.";
    action.textContent = "Return to login";
    action.href = "index.html?login=1#signin";
  } else {
    fetch("/api/account", { headers: { Accept: "application/json" } })
      .then(async (response) => {
        if (!response.ok) throw new Error("no-session");
        const account = await response.json();
        try {
          sessionStorage.removeItem("freeBookeryPendingVerificationEmail");
        } catch {
          // Nothing needs to be cleared when storage is unavailable.
        }
        message.textContent = `You're signed in as ${account.name || account.email}. Your reader account is ready.`;
        action.href = validBookId
          ? `reader.html?id=${encodeURIComponent(validBookId)}`
          : "index.html";
      })
      .catch(() => {
        message.textContent = "Your email is verified. Log in to continue to your reader account.";
        action.textContent = "Log in";
        action.href = "index.html?login=1#signin";
      });
  }
}
