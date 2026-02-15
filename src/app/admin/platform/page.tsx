import PlatformSettingsClient from "./PlatformSettingsClient";

export default async function PlatformPage() {
  return (
    <div className="max-w-[720px] mx-auto px-5 md:px-6 py-6">
      <PlatformSettingsClient />
    </div>
  );
}
