/**
 * A firmware module: a component of kind "software" whose slug starts with
 * "sw-" (publish_software.py names them so). The editors and the FPGA voice
 * are software too, but no module; they stay on /boards.
 */
export const isModule = (slug: string, kind: string | undefined) => kind === "software" && slug.startsWith("sw-");
