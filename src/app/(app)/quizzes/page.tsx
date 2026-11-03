import type { Metadata } from "next";
import { ClipboardCheck } from "lucide-react";
import PageHeading from "@/components/ui/page-heading";
import { ButtonLink, EmptyCard } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Practice arena" };

export default function QuizzesPage() {
  return (
    <>
      <PageHeading
        eyebrow="Low pressure / high learning"
        title="Practice makes"
        accent="progress visible."
        accentColor="coral"
        description="Short knowledge checks generated only from passages in your uploaded material, with the source page shown after each answer."
      />
      <EmptyCard icon={ClipboardCheck} title="No knowledge checks yet" action={<ButtonLink href="/courses" small>Upload course material</ButtonLink>}>
        Quizzes need at least one processed document so every question can point to real evidence.
      </EmptyCard>
    </>
  );
}
