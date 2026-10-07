import { Board } from "@/components/Board";

export default async function BoardPage({ searchParams }: PageProps<"/board">) {
  const { date } = await searchParams;
  const value = typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : undefined;
  return <Board date={value} />;
}
