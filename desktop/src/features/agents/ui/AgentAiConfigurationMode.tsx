import type * as React from "react";
import { SegmentedControl } from "@/shared/ui/segmented-control";
import type { AgentAiConfigurationMode } from "./agentAiConfigurationPolicy";
import { AgentAiDefaultsNotice } from "./AgentAiDefaults";
import type { InheritedDefault } from "./bakedEnvHelpers";

export type { AgentAiConfigurationMode } from "./agentAiConfigurationPolicy";

export function HarnessModelDefaultNotice({
  harness,
  model,
}: {
  harness: string;
  model?: string | null;
}) {
  return (
    <dl
      className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 text-sm"
      data-testid="agent-harness-defaults-notice"
    >
      <dt className="text-muted-foreground">Harness</dt>
      <dd className="truncate text-foreground">
        {harness || "Not configured"}
      </dd>
      <dt className="text-muted-foreground">Model</dt>
      <dd className="truncate text-foreground">
        {model?.trim() || "Harness default"}
      </dd>
    </dl>
  );
}

export function AgentCreateAiDefaultsSummary({
  canChooseProvider,
  harness,
  inheritedModel,
  inheritedProvider,
  isConfigured,
  model,
  onEditDefaults,
  triggerRef,
}: {
  canChooseProvider: boolean;
  harness: string;
  inheritedModel: InheritedDefault;
  inheritedProvider: InheritedDefault;
  isConfigured: boolean;
  model?: string | null;
  onEditDefaults: () => void;
  triggerRef?: React.Ref<HTMLButtonElement>;
}) {
  return canChooseProvider ? (
    <AgentAiDefaultsNotice
      isConfigured={isConfigured}
      onEditDefaults={onEditDefaults}
      triggerRef={triggerRef}
      explicitModel=""
      explicitProvider=""
      harness={harness}
      inheritedModel={inheritedModel}
      inheritedProvider={inheritedProvider}
    />
  ) : (
    <HarnessModelDefaultNotice harness={harness} model={model} />
  );
}

export function AgentAiConfigurationModeField({
  mode,
  needsProviderSelection = true,
  onModeChange,
}: {
  mode: AgentAiConfigurationMode;
  needsProviderSelection?: boolean;
  onModeChange: (mode: AgentAiConfigurationMode) => void;
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium text-foreground">AI configuration</p>
      {/* `h-9 w-full` overrides the shared control's `h-8` and its fixed
          `SIZE_CLASSES` width: this is a full-width form field, not a settings
          row. `className` is merged last, so both win. */}
      <SegmentedControl<AgentAiConfigurationMode>
        className="h-9 w-full"
        legend="AI configuration"
        onValueChange={onModeChange}
        optionTestIdPrefix="agent-ai-configuration-mode"
        options={[
          {
            value: "defaults",
            label: needsProviderSelection
              ? "Use agent defaults"
              : "Use harness defaults",
          },
          { value: "custom", label: "Customize for this agent" },
        ]}
        testId="agent-ai-configuration-mode"
        value={mode}
      />
    </div>
  );
}
