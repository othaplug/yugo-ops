import React from "react";
import { Text, Button, Flex, hubspot } from "@hubspot/ui-extensions";

const YUGO_APP_BASE_URL = "https://opsplus.co";

hubspot.extend<"crm.record.sidebar">(({ context }) => (
  <Extension context={context} />
));

const Extension = ({ context }) => {
  const dealId = context?.crm?.objectId;
  const quoteUrl = dealId
    ? `${OPS_BASE_URL}/admin/quotes/new?hubspot_deal_id=${dealId}`
    : null;

  return (
    <Flex direction="column" gap="medium">
      <Text>Create a quote in Yugo+ using this deal&apos;s details.</Text>
      {quoteUrl && (
        <Button
          href={{
            url: quoteUrl,
            external: true,
          }}
          variant="primary"
        >
          Generate Quote in Yugo+
        </Button>
      )}
    </Flex>
  );
};