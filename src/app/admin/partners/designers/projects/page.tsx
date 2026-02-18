import { PROJECTS } from "../projectsData";
import BackButton from "../../../components/BackButton";
import ViewAllProjectsClient from "./ViewAllProjectsClient";

export default function DesignerProjectsPage() {
  return (
    <div className="max-w-[1200px] mx-auto px-5 md:px-6 py-5 md:py-6 animate-fade-up">
      <div className="mb-4"><BackButton label="Designers" href="/admin/partners/designers" /></div>
      <h1 className="font-heading text-[20px] font-bold text-[var(--tx)] mb-3">All Projects</h1>
      <p className="text-[12px] text-[var(--tx3)] mb-6">Active, completed, and all designer projects</p>
      <ViewAllProjectsClient projects={PROJECTS} />
    </div>
  );
}
