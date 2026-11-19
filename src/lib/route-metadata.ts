const siteOrigin = "https://lclpo.vercel.app";
const socialImage = `${siteOrigin}/og-lclplan.png`;
const socialImageAlt = "LclPlan — referências de preços, memória de cálculo automatizada, licitações e Transferegov";

export function pageMetadata(title: string, description: string, path?: string) {
  const canonicalUrl = path ? new URL(path, siteOrigin).toString() : undefined;
  const meta = [
    { title: `${title} | LclPlan` },
    { name: "description", content: description },
    { property: "og:title", content: `${title} | LclPlan` },
    { property: "og:description", content: description },
    { property: "og:type", content: "website" },
    { property: "og:site_name", content: "LclPlan" },
    { property: "og:image", content: socialImage },
    { property: "og:image:alt", content: socialImageAlt },
    { property: "og:image:width", content: "1200" },
    { property: "og:image:height", content: "630" },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: `${title} | LclPlan` },
    { name: "twitter:description", content: description },
    { name: "twitter:image", content: socialImage },
    ...(canonicalUrl ? [{ property: "og:url", content: canonicalUrl }] : []),
  ];
  return {
    meta,
    ...(canonicalUrl ? { links: [{ rel: "canonical", href: canonicalUrl }] } : {}),
  };
}
