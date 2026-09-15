import { Inbox } from "lucide-react"

const DataTableEmpty = ({ title = "No data found", description = "There are no records to display." }) => {
    return (
        <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="mb-4 rounded-full bg-muted p-4">
                <Inbox className="h-8 w-8 text-muted-foreground" />
            </div>

            <h3 className="text-lg font-semibold">{title}</h3>

            <p className="mt-2 max-w-sm text-sm text-muted-foreground">{description}</p>
        </div>
    )
}

export default DataTableEmpty