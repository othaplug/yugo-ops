import { notFound } from "next/navigation";
import Link from "next/link";
import { getProjectById } from "../projectsData";
import ProjectDetailClient from "./ProjectDetailClient";

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = getProjectById(id);
  if (!project) notFound();

  return (
    <ProjectDetailClient project={project} />
  );
}
