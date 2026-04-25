"use client"

import { useState } from "react"

import { ContactsTable } from "@/components/ui/contacts-table-with-modal"

const ContactsTableDemo = () => {
  const [lastId, setLastId] = useState<string | null>(null)

  return (
    <div className="bg-background min-h-screen py-6 md:py-12">
      <div className="container mx-auto px-2 sm:px-4">
        <p className="text-muted-foreground mb-4 text-sm" aria-live="polite">
          {lastId
            ? `Last selection event for contact: ${lastId}`
            : "Toggle rows to test selection."}
        </p>
        <div className="mb-8 md:mb-12">
          <ContactsTable
            onContactSelect={(contactId) => {
              setLastId(contactId)
            }}
            title="Person"
          />
        </div>
      </div>
    </div>
  )
}

export default ContactsTableDemo
