export const dynamic = "force-dynamic";
export const revalidate = 0;

import ProjectDetailClient from "./ProjectDetailClient";

export default async function ProjectDetailPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;

  return (
    <div className="animate-fade-up">
      <ProjectDetailClient projectId={projectId} />
    </div>
  );
}
