import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ContactForm } from "@/components/contact-form";
import { accountTeksten, isUi } from "@/lib/account-teksten";
import { contactAction } from "./actions";

type Props = { params: Promise<{ ui: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: accountTeksten((await params).ui).kontakt.titel };
}

/** Write to the owner of the site, without showing an address. */
export default async function KontaktPage({ params }: Props) {
  const { ui } = await params;
  if (!isUi(ui)) notFound();
  const t = accountTeksten(ui).kontakt;
  return (
    <article lang={ui} className="max-w-xl space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">{t.titel}</h1>
      <p className="text-muted">{t.intro}</p>
      <ContactForm ui={ui} action={contactAction} />
    </article>
  );
}
