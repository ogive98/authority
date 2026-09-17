"use client";

import * as React from "react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { useUiT } from "@/lib/i18n/route-labels";

/** AUTHORITY button — D294; auto-localizes string children (D188). */
export const AButton = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ children, ...props }, ref) => {
    const { t } = useUiT();
    const localized =
      typeof children === "string" ? t(children) : children;
    return (
      <Button ref={ref} {...props}>
        {localized}
      </Button>
    );
  },
);
AButton.displayName = "AButton";
