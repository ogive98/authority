import * as React from "react";
import { Button, type ButtonProps } from "@/components/ui/button";

/** AUTHORITY button — tokens only; use instead of raw Button in product UI. */
export const AButton = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (props, ref) => <Button ref={ref} {...props} />,
);
AButton.displayName = "AButton";
