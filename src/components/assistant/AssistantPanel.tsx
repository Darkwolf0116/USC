"use client";

import {
  AssistantComposer,
  AssistantHeader,
  AssistantMessages,
  AssistantRoot,
  AssistantStatus,
} from "./AssistantPanelParts";

/**
 * Non-modal assistant panel, so the modal PDF viewer can open above it.
 *
 *   <AssistantPanel.Root>
 *     <AssistantPanel.Header />
 *     <AssistantPanel.Messages />
 *     <AssistantPanel.Status />
 *     <AssistantPanel.Composer />
 *   </AssistantPanel.Root>
 *
 * Rendering `<AssistantPanel />` mounts that default composition.
 */
function AssistantPanelDefault() {
  return (
    <AssistantRoot>
      <AssistantHeader />
      <AssistantMessages />
      <AssistantStatus />
      <AssistantComposer />
    </AssistantRoot>
  );
}

export const AssistantPanel = Object.assign(AssistantPanelDefault, {
  Root: AssistantRoot,
  Header: AssistantHeader,
  Messages: AssistantMessages,
  Status: AssistantStatus,
  Composer: AssistantComposer,
});
