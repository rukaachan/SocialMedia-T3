"use server";

import { redirect } from "next/navigation";
import { serverSignIn } from "~/lib/auth/server";

export async function signInAction(formData: FormData): Promise<void> {
  try {
    await serverSignIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: "/",
    });
  } catch (error) {
    if (
      error != null &&
      typeof error === "object" &&
      "digest" in error &&
      typeof error.digest === "string" &&
      error.digest.startsWith("NEXT_REDIRECT")
    ) {
      throw error;
    }

    redirect("/auth/sign-in?error=invalid_credentials");
  }
}
