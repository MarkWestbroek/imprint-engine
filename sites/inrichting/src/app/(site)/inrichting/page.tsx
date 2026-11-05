import type { Metadata } from "next";
import { readOpts } from "@imprint/runtime-admin";
import { OmniumLijst } from "@imprint/plugin-omnium";
import { PageView } from "@/components/page-view";
import { store } from "@/lib/content";
import { widgetContext } from "@/lib/widget-context";

/** The overview of the register (signed in): the page `inrichting` from the store, else the e-diensten and components directly. */

export const metadata: Metadata = { title: "Inrichting" };

export default async function Overview() {
  const page = await store.getPage("inrichting", await readOpts());
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
