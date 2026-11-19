type BrandProps = {
  tone?: "light" | "dark";
};

export function Brand({ tone = "light" }: BrandProps) {
  const wordmarkColor = tone === "dark" ? "text-sidebar-foreground" : "text-foreground";

  return (
    <span className="inline-flex items-center gap-2.5" aria-label="LclPlan">
      <svg aria-hidden="true" viewBox="0 0 40 40" className="size-9 shrink-0">
        <rect x="1" y="1" width="38" height="38" rx="11" fill="#142b43" />
        <path d="M9 29.5h22" stroke="#e7ad43" strokeWidth="2" strokeLinecap="round" />
        <path d="M11 27V19h5v8m3 0V14h5v13m3 0V9h4v18" fill="none" stroke="#f7f8fa" strokeWidth="2" strokeLinejoin="round" />
        <path d="M10 14h5" stroke="#e7ad43" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <span className={`text-[1.2rem] font-bold tracking-tight ${wordmarkColor}`}>
        Lcl<span className="font-medium">Plan</span>
      </span>
    </span>
  );
}
