"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type DefaultValues, type FieldValues, type Path } from "react-hook-form";
import { z } from "zod";
import { AButton } from "@/components/a/a-button";
import { ADecimalField } from "@/components/a/a-decimal-field";
import { AInput } from "@/components/a/a-input";
import { cn } from "@/lib/utils";

export type DynamicFieldType = "text" | "decimal";

export type DynamicFieldDef = {
  name: string;
  label: string;
  type: DynamicFieldType;
  unit?: string;
  placeholder?: string;
  required?: boolean;
};

export type ADynamicFormProps<T extends FieldValues> = {
  fields: DynamicFieldDef[];
  schema: z.ZodType<T>;
  defaultValues?: DefaultValues<T>;
  submitLabel?: string;
  onSubmit: (values: T) => void | Promise<void>;
  className?: string;
};

/**
 * Schema-driven form — labels visibles, validation près du champ.
 * Decimal fields use ADecimalField (no JS float input for TND/kg).
 */
export function ADynamicForm<T extends FieldValues>({
  fields,
  schema,
  defaultValues,
  submitLabel = "Enregistrer",
  onSubmit,
  className,
}: ADynamicFormProps<T>) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<T>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- zod v4 + RHF resolver typing
    resolver: zodResolver(schema as any),
    defaultValues,
  });

  return (
    <form
      className={cn("flex flex-col gap-4", className)}
      onSubmit={handleSubmit(async (values) => {
        await onSubmit(values);
      })}
      noValidate
    >
      {fields.map((field) => {
        const name = field.name as Path<T>;
        const err = errors[name];
        const message =
          err && typeof err === "object" && "message" in err
            ? String(err.message)
            : undefined;

        if (field.type === "decimal") {
          return (
            <ADecimalField
              key={field.name}
              label={field.label}
              unit={field.unit}
              placeholder={field.placeholder}
              error={message}
              {...register(name)}
            />
          );
        }

        return (
          <div key={field.name} className="flex flex-col gap-1.5">
            <label
              htmlFor={field.name}
              className="text-[length:var(--a-text-sm)] font-medium text-a-fg"
            >
              {field.label}
              {field.required ? (
                <span className="text-a-danger" aria-hidden>
                  {" "}
                  *
                </span>
              ) : null}
            </label>
            <AInput
              id={field.name}
              placeholder={field.placeholder}
              aria-invalid={message ? true : undefined}
              {...register(name)}
            />
            {message ? (
              <p className="text-[length:var(--a-text-xs)] text-a-danger" role="alert">
                {message}
              </p>
            ) : null}
          </div>
        );
      })}
      <div className="pt-1">
        <AButton type="submit" size="sm" disabled={isSubmitting}>
          {submitLabel}
        </AButton>
      </div>
    </form>
  );
}

/** Example schema for fromagerie weight split (commandé / préparé / facturé). */
export const weightSplitSchema = z.object({
  reference: z.string().min(1, "Référence obligatoire"),
  qtyOrdered: z
    .string()
    .min(1, "Quantité commandée obligatoire")
    .regex(/^\d+([.,]\d+)?$/, "Nombre invalide"),
  weightPrepared: z
    .string()
    .min(1, "Poids préparé obligatoire")
    .regex(/^\d+([.,]\d+)?$/, "Nombre invalide"),
  weightInvoiced: z
    .string()
    .min(1, "Poids facturé obligatoire")
    .regex(/^\d+([.,]\d+)?$/, "Nombre invalide"),
});

export type WeightSplitValues = z.infer<typeof weightSplitSchema>;

export const weightSplitFields: DynamicFieldDef[] = [
  {
    name: "reference",
    label: "Référence commande",
    type: "text",
    required: true,
    placeholder: "SO-2026-0042",
  },
  {
    name: "qtyOrdered",
    label: "Qté commandée",
    type: "decimal",
    unit: "kg",
    required: true,
  },
  {
    name: "weightPrepared",
    label: "Poids préparé",
    type: "decimal",
    unit: "kg",
    required: true,
  },
  {
    name: "weightInvoiced",
    label: "Poids facturé (règle serveur)",
    type: "decimal",
    unit: "kg",
    required: true,
  },
];
