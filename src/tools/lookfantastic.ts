import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { registerThgBeautyTools } from "./thg-beauty.js";

// Shapes mirror backend/src/routes/lookfantastic.ts (built by backend/src/routes/thg-beauty.ts with the LOOKFANTASTIC
// site config): 7 endpoints, 1 credit each, 10 sites (market) with the currencies each site's own selector offers.
// Either/or rules and the shared shapes live in ./thg-beauty.ts.

const LF_CURRENCIES = [
  "GBP", "USD", "EUR", "AUD", "CAD", "CHF", "SEK", "DKK", "NOK", "JPY", "KRW", "HKD", "SGD", "AED", "SAR", "ILS", "NZD", "CNY", "MYR", "TWD", "THB", "IDR", "PLN",
] as const;

export function registerLookfantasticTools(server: McpServer, getClient: () => ScavioClient) {
  registerThgBeautyTools(server, getClient, {
    id: "lookfantastic",
    name: "Lookfantastic",
    first: "Lookfantastic (lookfantastic.com, THG's beauty retailer with 10 country sites)",
    markets: ["gb", "de", "fr", "es", "it", "nl", "pl", "at", "ie", "eu"],
    currencies: LF_CURRENCIES,
    marketsDoc:
      "Markets (market, default gb): gb (www.lookfantastic.com, the UK and international site, English, 22 currencies: GBP default, USD, EUR, AUD, CAD, CHF, SEK, DKK, NOK, JPY, KRW, HKD, SGD, AED, SAR, ILS, NZD, CNY, MYR, TWD, THB, IDR), de (lookfantastic.de, German, EUR), fr (lookfantastic.fr, French, EUR), es (lookfantastic.es, Spanish, EUR), it (lookfantastic.it, Italian, EUR), nl (lookfantastic.nl, Dutch, EUR), pl (lookfantastic.pl, Polish, PLN default or EUR), at (lookfantastic.at, German, EUR), ie (lookfantastic.ie, English, EUR), eu (eu.lookfantastic.com, English, euro prices of its own).",
    currencyDoc:
      "The currency, as the site's own currency selector offers it (default: the site's own). gb takes any of its 22 (GBP default); pl takes PLN (default) or EUR; de, fr, es, it, nl, at, ie and eu take EUR only. A currency the site does not offer is a 400, not charged.",
    filters: {
      brand: ["CeraVe", "Brand, as the site names it (exact): facets[filter=brand].options[].value."],
      skin_type: ["Dry", "Skin type as the site lists it, e.g. Dry, Oily, Sensitive (in the site's language)."],
      concern: ["Anti-Ageing", "Skincare concern as the site lists it, e.g. Anti-Ageing, Dehydration."],
      spf: ["SPF 50+", "SPF band as the site lists it, e.g. SPF 30+, SPF 50+."],
      key_ingredient: ["Retinol", "Key ingredient as the site lists it, e.g. Retinol, Hyaluronic Acid, Niacinamide."],
      formulation: ["Vegan", "Formulation as the site lists it, e.g. Vegan, Fragrance Free, Alcohol Free."],
    },
    filtersProse: "brand, skin type, concern, SPF band, key ingredient, formulation",
    facetExample: "en_beauty_skinSubcategory_content",
    facetNote: "Facet names carry the site's language (en_ on lookfantastic.com, de_ on lookfantastic.de).",
    listExamples: "a category (/health-beauty/face/skincare-products/moisturisers), brand (/brands/cerave), sale or offer page (Black Friday: /black-friday)",
    pathExample: "/brands/cerave, /black-friday or /health-beauty/face/skincare-products/moisturisers",
    landingSuffix: "view-all",
    host: "www.lookfantastic.com",
    offersNote: "",
    captured: {
      search:
        "Captured 2026-11-26: PIXI Glow Tonic 250ml (SKU 11200055) at 12.6 GBP against an RRP of 18 (30% off) on lookfantastic.com, with the offer \"Save 30% + Extra 5% off | Use Code: EXTRA\"; on lookfantastic.fr the same SKU was 14.49 EUR (RRP 20.7), with French offer text.",
      list: "Captured 2026-11-26: /black-friday listed 13,665 products.",
      product:
        "Captured 2026-11-26: PIXI Glow Tonic 250ml (SKU 11200055, barcode 885190821006) at 12.6 GBP on gb and 14.49 EUR on fr, 2 size variants (100ml at 7 GBP).",
      offers: "Captured 2026-11-26: 7 offers on lookfantastic.com, with end times as given.",
      brands: "Captured 2026-11-26: 415 brands on lookfantastic.com.",
    },
    examples: { query: "glow tonic", sku: "11200055", suggest: "cerave" },
  });
}
