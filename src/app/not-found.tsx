import Link from "next/link";
import { EmptyState, PageHeader } from "@/components/primitives";

export default function NotFound() {
  return (
    <div className="space-y-10">
      <PageHeader eyebrow="404" title="Nothing here" />
      <EmptyState
        title="That page does not exist"
        description="The link may be stale, or the record it pointed at was deleted."
        action={
          <Link href="/" className="btn btn-primary">
            Back to Command
          </Link>
        }
      />
    </div>
  );
}
