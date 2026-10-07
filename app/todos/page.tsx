import { TodoList } from "@/components/TodoList";
import { parseTodoFilters } from "@/lib/client/filters";

export default async function TodosPage({ searchParams }: PageProps<"/todos">) {
  return <TodoList filters={parseTodoFilters(await searchParams)} />;
}
