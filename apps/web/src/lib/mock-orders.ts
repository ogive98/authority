/** Mock B2B orders for /preview/commandes — not the Sales module. */
export type OrderStatus = "paid" | "pending" | "overdue";

export type OrderRow = {
  id: string;
  client: string;
  amountTnd: string;
  status: OrderStatus;
  due: string;
};

export const MOCK_ORDERS: OrderRow[] = [
  {
    id: "SO-2026-0042",
    client: "Fromagerie Atlas",
    amountTnd: "12 450,000",
    status: "paid",
    due: "2026-09-18",
  },
  {
    id: "SO-2026-0043",
    client: "Société Lait Sfax",
    amountTnd: "3 280,560",
    status: "pending",
    due: "2026-09-22",
  },
  {
    id: "SO-2026-0044",
    client: "Distribution Nord",
    amountTnd: "8 910,000",
    status: "overdue",
    due: "2026-08-30",
  },
  {
    id: "SO-2026-0045",
    client: "Hôtel Palais",
    amountTnd: "1 234,560",
    status: "paid",
    due: "2026-09-12",
  },
  {
    id: "SO-2026-0046",
    client: "Centrale Laitière",
    amountTnd: "21 040,000",
    status: "pending",
    due: "2026-09-28",
  },
  {
    id: "SO-2026-0047",
    client: "Marché Gros Tunis",
    amountTnd: "6 775,250",
    status: "paid",
    due: "2026-09-15",
  },
];

export function orderStatusLabel(status: OrderStatus): string {
  if (status === "paid") return "Payée";
  if (status === "pending") return "En attente";
  return "En retard";
}
