import { redirect } from "next/navigation";

/** Preview mock retired — live lots UI. */
export default function PreviewLotsRedirect() {
  redirect("/inventory/lots");
}
