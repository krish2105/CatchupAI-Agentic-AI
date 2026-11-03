import type { Metadata } from "next";
import { TrendingUp } from "lucide-react";
import PageHeading from "@/components/ui/page-heading";
import { ButtonLink, EmptyCard, StatCard } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Your momentum" };

export default function InsightsPage() {
  return (
    <>
      <PageHeading
        eyebrow="The signal behind your progress"
        title="Celebrate the"
        accent="small wins."
        accentColor="aqua"
        description="Every number here is calculated from your saved plans and graded quiz attempts. Nothing is estimated or illustrative."
        actions={<ButtonLink href="/quizzes" small>Take a knowledge check</ButtonLink>}
      />
      <div className="stat-row">
        <StatCard label="Latest quiz" value={null} caption="No graded attempts yet" />
        <StatCard label="Tasks finished" value={null} caption="Across approved plans" />
        <StatCard label="Minutes completed" value={null} caption="From finished tasks" />
        <StatCard label="Active plans" value={null} caption="Approved and not archived" />
      </div>
      <EmptyCard icon={TrendingUp} title="Not enough evidence yet">
        Complete tasks from an approved plan or finish a knowledge check to see real trends and topic results.
      </EmptyCard>
    </>
  );
}
