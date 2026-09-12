export const HR_TABS = [
  "employees",
  "postes",
  "kinds",
  "templates",
  "bulletins",
] as const;

export type HrTab = (typeof HR_TABS)[number];

/** Resolve HR workspace tab from Mission Control query or legacy hash. */
export function parseHrTab(
  search: string,
  hash = "",
): HrTab {
  const qs = search.startsWith("?") ? search.slice(1) : search;
  const tab = new URLSearchParams(qs).get("tab")?.trim().toLowerCase();
  if (tab === "postes" || tab === "job-titles" || tab === "jobs") {
    return "postes";
  }
  if (tab === "kinds" || tab === "doc-kinds" || tab === "documents-kinds") {
    return "kinds";
  }
  if (tab === "templates" || tab === "contract-templates" || tab === "print") {
    return "templates";
  }
  if (tab === "bulletins" || tab === "payslips") return "bulletins";
  if (tab === "employees" || tab === "employes") return "employees";

  const h = hash.replace(/^#/, "").trim().toLowerCase();
  if (h === "postes" || h === "job-titles") return "postes";
  if (h === "kinds" || h === "doc-kinds") return "kinds";
  if (h === "templates" || h === "print") return "templates";
  if (h === "bulletins") return "bulletins";
  return "employees";
}

export function hrTabHref(tab: HrTab): string {
  return tab === "employees" ? "/hr" : `/hr?tab=${tab}`;
}

export function hrEmployeeHref(id: string): string {
  return `/hr/employees/${encodeURIComponent(id)}`;
}
