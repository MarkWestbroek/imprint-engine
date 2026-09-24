import { notFound } from "next/navigation";
import type { AdminContext } from "../admin-context";
import { pluginOf, type PluginCall } from "../plugin";

/**
 * The admin-screen hook (design/fase-5 §3.3): the site's `[type]` routes
 * render this when the first segment is not a content type. The plugin
 * decides what `/admin/<name>/<path>` shows; no plugin, or no screen for
 * that path, is a 404 like any other unknown admin URL.
 */
export async function PluginScreen({
  admin,
  name,
  path,
  call,
}: {
  admin: AdminContext;
  name: string;
  path: string[];
  call: PluginCall;
}) {
  const plugin = pluginOf(admin, name);
  if (!plugin?.screen) notFound();
  const rendered = await plugin.screen({ admin, path, call });
  if (rendered === null) notFound();
  return <>{rendered}</>;
}
