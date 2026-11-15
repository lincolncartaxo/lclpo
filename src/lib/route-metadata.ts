export function pageMetadata(title: string, description: string) {
  return { meta: [
    { title: `${title} | LclPlan` },
    { name: "description", content: description },
    { property: "og:title", content: `${title} | LclPlan` },
    { property: "og:description", content: description },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] };
}