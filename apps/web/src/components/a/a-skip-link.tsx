export function ASkipLink({
  href = "#main",
  children = "Aller au contenu",
}: {
  href?: string;
  children?: string;
}) {
  return (
    <a href={href} className="a-skip-link">
      {children}
    </a>
  );
}
