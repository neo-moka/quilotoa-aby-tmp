import { ChevronDown } from "lucide-react";
import type * as React from "react";
import { Select } from "@/shared/ui/select";

export function FormSelect({
  children,
  disabled,
  id,
  onChange,
  value,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  id?: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <div className="relative">
      <Select
        className="appearance-none bg-transparent pr-8 text-sm"
        disabled={disabled}
        id={id}
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        {children}
      </Select>
      <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
}

export function FieldLabel({
  children,
  htmlFor,
}: {
  children: React.ReactNode;
  htmlFor?: string;
}) {
  return (
    <label
      className="block text-xs font-medium text-muted-foreground"
      htmlFor={htmlFor}
    >
      {children}
    </label>
  );
}
