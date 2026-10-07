import { WeekDetail } from "@/components/WeekDetail";

export default async function WeekPage({ params }: PageProps<"/weeks/[id]">) {
  const { id } = await params;
  return <WeekDetail id={id} />;
}
