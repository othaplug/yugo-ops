import BuildingEditorClient from "../BuildingEditorClient";

export const metadata = { title: "New building" };

export default function NewBuildingPage() {
  return <BuildingEditorClient initial={null} />;
}
