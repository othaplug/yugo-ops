import { InteractiveLogsTable } from "@/components/ui/interactive-logs-table-shadcnui"

const InteractiveLogsTableDemo = () => {
  return (
    <div className="bg-background flex min-h-screen w-full justify-center p-8">
      <div className="h-[min(100vh,900px)] w-full max-w-6xl">
        <InteractiveLogsTable className="h-full" />
      </div>
    </div>
  )
}

export default InteractiveLogsTableDemo
