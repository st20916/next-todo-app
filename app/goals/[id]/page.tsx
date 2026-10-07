import { GoalDetail } from "@/components/GoalDetail";

export default async function GoalPage({ params }: PageProps<"/goals/[id]">) {
  const { id } = await params;
  return <GoalDetail id={id} />;
}
