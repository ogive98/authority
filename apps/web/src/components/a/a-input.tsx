import * as React from "react";
import { Input, type InputProps } from "@/components/ui/input";

/** AUTHORITY text input — tokens only. */
export const AInput = React.forwardRef<HTMLInputElement, InputProps>(
  (props, ref) => <Input ref={ref} {...props} />,
);
AInput.displayName = "AInput";
