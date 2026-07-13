import {
  DEFAULT_RELATION_RULES,
  RelationsDoc,
  type RelationRule,
} from "@imprint/content-core";
import { writableStore } from "@/lib/content";
import { RelationsEditor } from "@/components/admin/relations-editor";

// Reference rules that content types point at each other by.
const TYPES = ["product", "component", "release", "page", "menu", "site"];

export default async function AdminRelations() {
  const item = await writableStore!.getItem("relations", "relations");
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
        <RelationsEditor initialRules={rules} types={TYPES} defaults={DEFAULT_RELATION_RULES} />
      </div>
    </div>
  );
}
