import { FormulaLibrary } from "@/components/formula-library";

export default async function FormulasPage({
  searchParams,
}: {
  searchParams: Promise<{ focus?: string }>;
}) {
  const { focus } = await searchParams;
  return <FormulaLibrary focusId={focus} />;
}
