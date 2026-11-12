import { redirect } from "next/navigation";
import { pakketHref } from "@imprint/plugin-taal";
import { TAAL } from "../../../imprint.config";

/** The site opens on the lessons of its package, in its own interface language: `/pl/nederlands`. */
export default function Home() {
  redirect(pakketHref(TAAL.standaardUi, TAAL.pakket));
}
