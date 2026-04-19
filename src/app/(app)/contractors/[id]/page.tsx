import { redirect } from "next/navigation";

export default async function ContractorRedirectByIdPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/vehicles/${id}`);
}
