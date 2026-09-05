"use client";

import { useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AButton } from "@/components/a/a-button";
import { AInput } from "@/components/a/a-input";
import { AScreenHeader } from "@/components/a/a-screen-header";
import {
  PORTAL_API,
  PORTAL_ORDERS_PATH,
  type PortalCatalogItem,
} from "@/lib/customer-portal";

type CartLine = {
  productId: string;
  sku: string;
  name: string;
  uom: string;
  qty: string;
  unitPrice: string;
  currency: string;
};

export function PortalNewOrderForm({
  catalog,
  blocked,
}: {
  catalog: PortalCatalogItem[];
  blocked: boolean;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [requestedDate, setRequestedDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return catalog;
    return catalog.filter(
      (p) =>
        p.sku.toLowerCase().includes(needle) ||
        p.name.toLowerCase().includes(needle),
    );
  }, [catalog, q]);

  function addProduct(item: PortalCatalogItem) {
    if (item.lastUnitPrice == null) {
      setError(
        `${item.sku} : pas de prix historique — utilisez « Recommander » sur une commande existante, ou contactez l’ADV.`,
      );
      return;
    }
    setError(null);
    setCart((prev) => {
      const existing = prev.find((l) => l.productId === item.id);
      if (existing) {
        const nextQty = String(Number(existing.qty) + 1);
        return prev.map((l) =>
          l.productId === item.id ? { ...l, qty: nextQty } : l,
        );
      }
      return [
        ...prev,
        {
          productId: item.id,
          sku: item.sku,
          name: item.name,
          uom: item.uom,
          qty: "1",
          unitPrice: item.lastUnitPrice!,
          currency: item.currency,
        },
      ];
    });
  }

  function updateQty(productId: string, qty: string) {
    setCart((prev) =>
      prev.map((l) => (l.productId === productId ? { ...l, qty } : l)),
    );
  }

  function removeLine(productId: string) {
    setCart((prev) => prev.filter((l) => l.productId !== productId));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (cart.length === 0) {
      setError("Ajoutez au moins un produit.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(PORTAL_API.orders, {
        method: "POST",
        credentials: "include",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          lines: cart.map((l) => ({
            productId: l.productId,
            qty: Number(l.qty),
          })),
          ...(requestedDate ? { requestedDate } : {}),
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        id?: string;
        message?: string | string[];
        code?: string;
      };
      if (res.ok && body.id) {
        router.replace(`${PORTAL_ORDERS_PATH}/${body.id}`);
        router.refresh();
        return;
      }
      const msg = Array.isArray(body.message)
        ? body.message.join(" ")
        : body.message;
      setError(msg ?? "Création refusée.");
    } catch {
      setError("API indisponible.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <AScreenHeader
        kicker="Customer Portal"
        title="Nouvelle commande"
        description="Brouillon Sales — prix = dernier tarif client. Confirmation ADV."
        actions={
          <Link
            href={PORTAL_ORDERS_PATH}
            className="text-[length:var(--a-text-sm)] text-a-accent hover:underline"
          >
            ← Commandes
          </Link>
        }
      />
      <form
        onSubmit={submit}
        className="space-y-[var(--a-space-5)] px-[var(--a-space-6)] py-[var(--a-space-5)]"
      >
        {blocked ? (
          <p
            className="rounded-[var(--a-radius-md)] border border-a-warning/40 bg-a-warning-soft px-3 py-2 text-[length:var(--a-text-sm)] text-a-warning-fg"
            role="status"
          >
            Compte bloqué : vous pouvez créer un brouillon, la confirmation ADV
            sera refusée jusqu’à déblocage.
          </p>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="a-card space-y-3 p-[var(--a-space-4)]">
            <p className="text-[length:var(--a-text-sm)] font-medium">
              Catalogue
            </p>
            <AInput
              placeholder="Rechercher SKU ou nom…"
              value={q}
              onChange={(ev) => setQ(ev.target.value)}
              aria-label="Filtrer le catalogue"
            />
            <div className="max-h-80 overflow-y-auto">
              <table className="w-full border-collapse text-left text-[length:var(--a-text-sm)]">
                <thead className="sticky top-0 bg-a-surface-2 text-a-fg-muted">
                  <tr>
                    <th className="a-table-cell font-medium">Produit</th>
                    <th className="a-table-cell text-right font-medium">
                      Dernier P.U.
                    </th>
                    <th className="a-table-cell" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((item) => (
                    <tr
                      key={item.id}
                      className="border-t border-a-border-subtle"
                    >
                      <td className="a-table-cell">
                        <span className="a-mono text-a-fg-muted">
                          {item.sku}
                        </span>
                        <br />
                        {item.name}
                        <span className="text-a-fg-subtle"> · {item.uom}</span>
                      </td>
                      <td className="a-mono a-tabular a-table-cell text-right">
                        {item.lastUnitPrice != null
                          ? `${item.lastUnitPrice} ${item.currency}`
                          : "—"}
                      </td>
                      <td className="a-table-cell text-right">
                        <AButton
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={item.lastUnitPrice == null}
                          onClick={() => addProduct(item)}
                        >
                          Ajouter
                        </AButton>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filtered.length === 0 ? (
                <p className="px-2 py-4 text-[length:var(--a-text-sm)] text-a-fg-muted">
                  Aucun produit.
                </p>
              ) : null}
            </div>
          </div>

          <div className="a-card space-y-3 p-[var(--a-space-4)]">
            <p className="text-[length:var(--a-text-sm)] font-medium">Panier</p>
            {cart.length === 0 ? (
              <p className="text-[length:var(--a-text-sm)] text-a-fg-muted">
                Sélectionnez des produits avec un prix historique.
              </p>
            ) : (
              <ul className="space-y-3">
                {cart.map((line) => (
                  <li
                    key={line.productId}
                    className="flex flex-wrap items-end gap-2 border-b border-a-border-subtle pb-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="a-mono text-[length:var(--a-text-xs)] text-a-fg-muted">
                        {line.sku}
                      </p>
                      <p className="text-[length:var(--a-text-sm)]">
                        {line.name}
                      </p>
                      <p className="a-mono a-tabular text-[length:var(--a-text-xs)] text-a-fg-muted">
                        {line.unitPrice} {line.currency} / {line.uom}
                      </p>
                    </div>
                    <div className="w-24">
                      <label
                        htmlFor={`qty-${line.productId}`}
                        className="text-[length:var(--a-text-xs)] text-a-fg-muted"
                      >
                        Qté
                      </label>
                      <AInput
                        id={`qty-${line.productId}`}
                        type="number"
                        min={0.001}
                        step="any"
                        value={line.qty}
                        onChange={(ev) =>
                          updateQty(line.productId, ev.target.value)
                        }
                        required
                      />
                    </div>
                    <AButton
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeLine(line.productId)}
                    >
                      Retirer
                    </AButton>
                  </li>
                ))}
              </ul>
            )}

            <div className="space-y-1.5">
              <label
                htmlFor="requested-date"
                className="text-[length:var(--a-text-sm)]"
              >
                Date demandée (optionnel)
              </label>
              <AInput
                id="requested-date"
                type="date"
                value={requestedDate}
                onChange={(ev) => setRequestedDate(ev.target.value)}
              />
            </div>

            {error ? (
              <p
                className="text-[length:var(--a-text-sm)] text-a-danger"
                role="alert"
              >
                {error}
              </p>
            ) : null}

            <AButton
              type="submit"
              className="w-full"
              disabled={busy || cart.length === 0}
            >
              {busy ? "Création…" : "Créer le brouillon"}
            </AButton>
          </div>
        </div>
      </form>
    </div>
  );
}
