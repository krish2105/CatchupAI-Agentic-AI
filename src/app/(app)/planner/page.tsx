import type { Metadata } from "next";
import { CalendarDays } from "lucide-react";
import PageHeading from "@/components/ui/page-heading";
import { ButtonLink, EmptyCard } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Study schedule" };

export default function PlannerPage() {
  return (
    <>
      <PageHeading
        eyebrow="Your time / your terms"
        title="A calmer"
        accent="kind of calendar."
        accentColor="aqua"
        description="Approved recovery tasks become your study schedule, shown in your own time zone. Tick tasks off as you complete them."
        actions={<ButtonLink href="/recovery" variant="primary" small>Compare plans</ButtonLink>}
      />
      <EmptyCard icon={CalendarDays} title="No approved plan yet" action={<ButtonLink href="/recovery" small>Open the recovery lab</ButtonLink>}>
        Review and approve a recovery route in the lab to populate your schedule. Rejected proposals never create tasks.
      </EmptyCard>
    </>
  );
}
