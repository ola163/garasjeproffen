import type { MetadataRoute } from "next";

const BASE = "https://www.garasjeproffen.no";

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = [
    { url: "/", priority: 1.0, changeFrequency: "weekly" as const },
    { url: "/garasje", priority: 0.9, changeFrequency: "monthly" as const },
    { url: "/carport", priority: 0.9, changeFrequency: "monthly" as const },
    { url: "/configurator", priority: 0.8, changeFrequency: "monthly" as const },
    { url: "/soknadshjelp", priority: 0.8, changeFrequency: "monthly" as const },
    { url: "/garasje-rogaland", priority: 0.8, changeFrequency: "monthly" as const },
    { url: "/byggesoknad-garasje", priority: 0.8, changeFrequency: "monthly" as const },
    { url: "/garasje-bryne", priority: 0.8, changeFrequency: "monthly" as const },
    { url: "/garasje-jaeren", priority: 0.8, changeFrequency: "monthly" as const },
    { url: "/garasje-stavanger", priority: 0.8, changeFrequency: "monthly" as const },
    { url: "/garasje-sandnes", priority: 0.8, changeFrequency: "monthly" as const },
    { url: "/materialpakke-garasje", priority: 0.8, changeFrequency: "monthly" as const },
    { url: "/prefabrikkert-garasje", priority: 0.8, changeFrequency: "monthly" as const },
    { url: "/referanseprosjekter", priority: 0.7, changeFrequency: "monthly" as const },
    { url: "/kontakt", priority: 0.7, changeFrequency: "yearly" as const },
    { url: "/om-oss", priority: 0.6, changeFrequency: "yearly" as const },
    { url: "/vilkar", priority: 0.4, changeFrequency: "yearly" as const },
  ];

  return routes.map(({ url, priority, changeFrequency }) => ({
    url: `${BASE}${url}`,
    lastModified: new Date(),
    changeFrequency,
    priority,
  }));
}
