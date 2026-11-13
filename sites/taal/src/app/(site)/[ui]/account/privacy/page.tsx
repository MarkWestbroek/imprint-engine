import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Markdown } from "@imprint/runtime-admin";
import { vormen } from "@imprint/plugin-taal/tekst";
import { accountTeksten, isUi } from "@/lib/account-teksten";

type Props = { params: Promise<{ ui: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: accountTeksten((await params).ui).privacy };
}

/** What the site keeps about a learner, in the language of the site. */
export default async function PrivacyPage({ params }: Props) {
  const { ui } = await params;
  if (!isUi(ui)) notFound();
  const t = accountTeksten(ui);
  return (
    <article lang={ui} className="max-w-2xl">
      <h1 className="text-3xl font-semibold tracking-tight">{t.privacy}</h1>
      <div className="markdown mt-6">
        <Markdown>{vormen(t.privacyTekst)}</Markdown>
      </div>
    </article>
  );
}
