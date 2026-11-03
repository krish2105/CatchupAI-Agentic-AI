import type { Metadata } from "next";
import { BookOpen } from "lucide-react";
import PageHeading from "@/components/ui/page-heading";
import { EmptyCard } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Knowledge vault" };

export default function CoursesPage() {
  return (
    <>
      <PageHeading
        eyebrow="Your evidence library"
        title="Knowledge,"
        accent="beautifully connected."
        accentColor="violet"
        description="Documents are stored privately, split into page-referenced passages and only ever searched on your behalf. Answers cite the pages they came from."
      />
      <EmptyCard icon={BookOpen} title="No courses yet">
        Create a course to add assignments and upload text-based PDF notes.
      </EmptyCard>
    </>
  );
}
