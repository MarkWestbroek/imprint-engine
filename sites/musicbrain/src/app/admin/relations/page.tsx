import {
  DEFAULT_RELATION_RULES,
  RelationsDoc,
  type RelationRule,
} from "@imprint/content-core";
import { contentTypes, writableStore } from "@/lib/content";
import { RelationsEditor } from "@imprint/runtime-admin/admin";
import { saveRelationsAction } from "../actions";

export default async function AdminRelations() {
  const item = await writableStore!.getItem("relations", "relations");
  // Rules may run between any two active types — except the rules document itself.
  const relatable = contentTypes.types().filter((type) => type !== "relations");
  const rules: RelationRule[] = item ? RelationsDoc.parse(item.data).rules : [];

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-semibold tracking-tight">Relations</h1>
      <p className="mt-1 text-sm text-muted">
        Referential integrity between content types. The store checks these on
        every save (and on API writes), so e.g. a release can only reference
        components that exist.
      </p>
      <div className="mt-6">
        <RelationsEditor action={saveRelationsAction} initialRules={rules} types={relatable} defaults={DEFAULT_RELATION_RULES} />
      </div>
    </div>
  );
}
