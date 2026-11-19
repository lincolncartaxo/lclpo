const socialImage = "/og-lclplan.png";
const socialImageAlt = "LclPlan — orçamentos de obras públicas com SINAPI, DER, BDI e cronograma";

export function pageMetadata(title: string, description: string) {
  return {
    meta: [
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
    ],
  };
}
