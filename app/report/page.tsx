import { ReportView } from "@/components/report-view";

export default async function ReportPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const { id } = await searchParams;
  return <ReportView id={id} />;
}
