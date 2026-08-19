const defaultSender =
  "Free Bookery <notifications@notifications.freebookery.org>";
const defaultReplyTo = "info@freebookery.org";

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function emailMarkup({ heading, message, actionLabel, actionUrl }) {
  const safeHeading = escapeHtml(heading);
  const safeMessage = escapeHtml(message);
  const safeLabel = escapeHtml(actionLabel);
  const safeUrl = escapeHtml(actionUrl);

  return `<!doctype html>
<html lang="en">
  <body style="margin:0;background:#f7f2e7;color:#100b2b;font-family:Arial,sans-serif">
    <div style="max-width:560px;margin:0 auto;padding:40px 24px">
      <p style="font-weight:700">Free Bookery</p>
      <h1 style="font-size:28px">${safeHeading}</h1>
      <p style="font-size:16px;line-height:1.6">${safeMessage}</p>
      <p style="margin:32px 0">
        <a href="${safeUrl}" style="display:inline-block;background:#100b2b;color:#fffaf0;padding:14px 22px;border-radius:8px;text-decoration:none;font-weight:700">${safeLabel}</a>
      </p>
      <p style="font-size:13px;line-height:1.5;color:#554f67">If you did not request this message, you can safely ignore it.</p>
    </div>
  </body>
</html>`;
}

export async function sendTransactionalEmail(env, email) {
  if (env.EMAIL_DELIVERY_MODE !== "live") {
    console.info(`[email:local] Suppressed ${email.type} email.`);
    return { suppressed: true };
  }

  if (!env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY is not configured.");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: env.EMAIL_FROM || defaultSender,
      to: [email.to],
      reply_to: env.EMAIL_REPLY_TO || defaultReplyTo,
      subject: email.subject,
      text: `${email.message}\n\n${email.actionLabel}: ${email.actionUrl}`,
      html: emailMarkup(email),
    }),
  });

  if (!response.ok) {
    throw new Error(`Email provider rejected the request (${response.status}).`);
  }

  return response.json();
}

export function queueTransactionalEmail(context, env, email) {
  const delivery = sendTransactionalEmail(env, email).catch((error) => {
    console.error("Transactional email delivery failed.", error);
  });

  if (context?.waitUntil) {
    context.waitUntil(delivery);
  }
}
