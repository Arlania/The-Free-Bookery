import { betterAuth } from "better-auth";
import { queueTransactionalEmail } from "./email.js";

export function createAuth(env, requestUrl, executionContext) {
  const origin = new URL(requestUrl).origin;
  const baseURL = env.BETTER_AUTH_URL || origin;
  const trustedOrigins = [baseURL];

  if (baseURL === "http://127.0.0.1:8787") {
    trustedOrigins.push("http://localhost:8787");
  } else if (baseURL === "http://localhost:8787") {
    trustedOrigins.push("http://127.0.0.1:8787");
  }

  return betterAuth({
    database: env.DB,
    secret: env.BETTER_AUTH_SECRET,
    baseURL,
    basePath: "/api/auth",
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: env.EMAIL_DELIVERY_MODE === "live",
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) => {
        queueTransactionalEmail(executionContext, env, {
          type: "password-reset",
          to: user.email,
          subject: "Reset your Free Bookery password",
          heading: "Reset your password",
          message:
            "Use the secure link below to choose a new Free Bookery password. This link expires in one hour.",
          actionLabel: "Reset password",
          actionUrl: url,
        });
      },
    },
    emailVerification: {
      sendOnSignUp: env.EMAIL_DELIVERY_MODE === "live",
      sendOnSignIn: env.EMAIL_DELIVERY_MODE === "live",
      autoSignInAfterVerification: true,
      sendVerificationEmail: async ({ user, url }) => {
        queueTransactionalEmail(executionContext, env, {
          type: "email-verification",
          to: user.email,
          subject: "Verify your Free Bookery email",
          heading: "Verify your email",
          message:
            "Confirm that this email address belongs to you before signing in to Free Bookery.",
          actionLabel: "Verify email",
          actionUrl: url,
        });
      },
    },
    trustedOrigins,
    logger: {
      level: "error",
    },
  });
}
