import { ContractorForm } from "@/components/contractors/ContractorForm";

export default function NewContractorPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">New vehicle</h1>
      <ContractorForm />
    </div>
  );
}
