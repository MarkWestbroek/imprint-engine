import type { ReactNode } from "react";
import type { ImprintPluginCore } from "@imprint/extension-api";
import type { AdminContext } from "./admin-context";

/**
 * Plugins (design/fase-5 §3.2): a site-wide capability a site switches on in
 * `imprint.config.ts`. The React-free half (`ImprintPluginCore`: content
 * types, widget schemas, menu items) is what `createImprint` merges; this is
 * the React half the admin uses — screens, actions and, later, a public
 * route. A plugin object carries both; `definePlugin` checks the shape once.
 *
 * Routes and actions go through three fixed hooks in a site (§3.3), so
 * switching a plugin on is one line of config:
 *  - `/admin/<name>/…` → `PluginScreen` (the `[type]` route asks the plugins
 *    when the segment is not a content type);
 *  - the site's one `pluginAction(plugin, action, ...args)` server action →
 *    `runPluginAction`;
 *  - the public catch-all → `publicRoute` (Fase 5, step 4).
 */

/** The site's dispatcher server action, handed to plugin screens and their client parts. */
export type PluginCall = (plugin: string, action: string, ...args: unknown[]) => Promise<unknown>;

export type PluginScreenProps = {
  admin: AdminContext;
  /** The path after `/admin/<name>`: [] for the plugin's index. */
  path: string[];
  call: PluginCall;
};

/** `never[]` so any concrete signature fits (parameters are contravariant); the dispatcher passes what the client sent. */
export type PluginAction = (admin: AdminContext, ...args: never[]) => Promise<unknown>;

export interface ImprintPlugin extends ImprintPluginCore {
  /** Renders `/admin/<name>/<path>`; null = not found. */
  screen?: (props: PluginScreenProps) => ReactNode | Promise<ReactNode | null> | null;
  /** Server-side actions, by name; each checks the session itself. */
  actions?: Record<string, PluginAction>;
}

const NAME_RE = /^[a-z][a-z0-9-]*$/;

export function definePlugin(plugin: ImprintPlugin): ImprintPlugin {
  if (!NAME_RE.test(plugin.name)) {
    throw new Error(`plugin name "${plugin.name}" must be lowercase letters, digits and dashes`);
  }
  if (!plugin.version) throw new Error(`plugin "${plugin.name}" needs a version`);
  return plugin;
}

export function pluginOf(admin: AdminContext, name: string): ImprintPlugin | undefined {
  return admin.plugins.find((p) => p.name === name);
}

/** Behind the site's `pluginAction`: find the plugin and the action, run it with the context. */
export async function runPluginAction(admin: AdminContext, plugin: string, action: string, args: unknown[]): Promise<unknown> {
  const fn = pluginOf(admin, plugin)?.actions?.[action];
  if (!fn || !Object.hasOwn(pluginOf(admin, plugin)!.actions!, action)) {
    throw new Error(`Unknown plugin action "${plugin}.${action}"`);
  }
  return fn(admin, ...(args as never[]));
}
