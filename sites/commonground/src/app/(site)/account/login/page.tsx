import type { Metadata } from "next";
import { LoginForm } from "@/components/account-forms";
import { loginAction } from "../actions";

export const metadata: Metadata = { title: "Inloggen", robots: { index: false } };

type Props = { searchParams: Promise<{ next?: string }> };

/** Sign in on the public site; `next` brings the visitor back to where they were (a group, an invitation). */
export default async function LoginPage({ searchParams }: Props) {
  const { next } = await searchParams;
  return (
    <article className="cg-page cg-narrow">
      <h1>Inloggen</h1>
      <LoginForm action={loginAction} next={next && next.startsWith("/") ? next : "/account"} />
    </article>
  );
}
