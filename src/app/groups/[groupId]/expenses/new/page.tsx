import { redirect } from "next/navigation";

// The Add Expense flow is a bottom sheet on the group overview. This route
// keeps a stable URL and sends users to the group where they can add expenses.
export default function NewExpensePage({
  params,
}: {
  params: { groupId: string };
}) {
  redirect(`/groups/${params.groupId}`);
}
