import { StoryboardView } from "@/components/storyboard-view";

export default async function StoryboardPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const { id } = await searchParams;
  return <StoryboardView id={id} />;
}
