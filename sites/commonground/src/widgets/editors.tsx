"use client";

import { DefaultWidgetEditor, type WidgetEditorProps } from "@imprint/runtime-admin/admin";
import { standardEditors } from "@imprint/widgets-standard/editors";

/** This site's widget editor for the studio: the standard editors, else the generated form. */
export function WidgetEditorFor(props: WidgetEditorProps) {
  const Custom = standardEditors[props.type];
  return Custom ? <Custom {...props} /> : <DefaultWidgetEditor {...props} />;
}
