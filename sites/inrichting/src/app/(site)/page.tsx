import type { Metadata } from "next";
import { readOpts } from "@imprint/runtime-admin";
import { OmniumLijst } from "@imprint/plugin-omnium";
import { PageView } from "@/components/page-view";
import { store } from "@/lib/content";
import { widgetContext } from "@/lib/widget-context";

/** The overview is the page `home` from the store; without it, the e-diensten and components straight from the register. */

export async function generateMetadata(): Promise<Metadata> {
  const page = await store.getPage("home");
  return page?.description ? { description: page.description } : {};
}

export default async function Home() {
  const page = await store.getPage("home", await readOpts());
  if (page) return <PageView page={page} />;
  const ctx = await widgetContext();
  return (
    <div className="space-y-10">
      <h1>Inrichting</h1>
      <OmniumLijst config={{ title: "E-diensten", pad: "ediensten" }} ctx={ctx} />
      <OmniumLijst config={{ title: "Componenten", pad: "componenten" }} ctx={ctx} />
    </div>
  );
}
