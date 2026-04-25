import PillMorphTabs from "@/components/ui/pill-morph-tabs"

const DemoOne = () => {
  return (
    <div className="bg-background flex h-screen w-full items-center justify-center">
      <PillMorphTabs
        className="max-w-md"
        defaultValue="overview"
        items={[
          {
            value: "overview",
            label: "Overview",
            panel: (
              <div className="p-4 text-left">
                <h2 className="text-lg font-semibold">Overview</h2>
                <p className="text-muted-foreground text-sm">
                  This is the overview section of your app.
                </p>
              </div>
            ),
          },
          {
            value: "features",
            label: "Features",
            panel: (
              <div className="p-4 text-left">
                <h2 className="text-lg font-semibold">Features</h2>
                <p className="text-muted-foreground text-sm">
                  Cool features listed here.
                </p>
              </div>
            ),
          },
          {
            value: "pricing",
            label: "Pricing",
            panel: (
              <div className="p-4 text-left">
                <h2 className="text-lg font-semibold">Pricing</h2>
                <p className="text-muted-foreground text-sm">
                  Choose the best plan for you.
                </p>
              </div>
            ),
          },
          {
            value: "faq",
            label: "FAQ",
            panel: (
              <div className="p-4 text-left">
                <h2 className="text-lg font-semibold">FAQ</h2>
                <p className="text-muted-foreground text-sm">
                  Find answers to common questions here.
                </p>
              </div>
            ),
          },
        ]}
      />
    </div>
  )
}

export default DemoOne
