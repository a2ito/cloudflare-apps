"use server";

import { signInWithGoogle as startGoogleSignIn, signOutUser } from "@/lib/auth";

export async function signInWithGoogle() {
  await startGoogleSignIn();
}

export async function signOutToTop() {
  await signOutUser();
}
