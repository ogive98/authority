import { redirect } from "next/navigation";

/** D102 — Articles fromage merged into Products catalogue; certificate lives here. */
export default function InventoryArticlesRedirectPage() {
  redirect("/inventory/certificat-salubrite");
}
