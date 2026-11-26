import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { registerThgBeautyTools } from "./thg-beauty.js";

// Shapes mirror backend/src/routes/cultbeauty.ts (built by backend/src/routes/thg-beauty.ts with the CULTBEAUTY site
// config): 7 endpoints, 1 credit each, 2 sites (market gb or intl), 12 currencies on each. Offers are not available
// on intl (cultbeauty.com has no voucher-codes page: a 400, not charged). Either/or rules and the shared shapes live
// in ./thg-beauty.ts.

const CB_CURRENCIES = ["GBP", "EUR", "USD", "AUD", "CHF", "AED", "SAR", "ILS", "HKD", "SGD", "JPY", "CNY"] as const;

export function registerCultbeautyTools(server: McpServer, getClient: () => ScavioClient) {
  registerThgBeautyTools(server, getClient, {
    id: "cultbeauty",
    name: "Cult Beauty",
    first: "Cult Beauty (cultbeauty.co.uk, THG's beauty retailer)",
    markets: ["gb", "intl"],
    currencies: CB_CURRENCIES,
    marketsDoc:
      "Markets (market, default gb): gb (www.cultbeauty.co.uk, the UK site, GBP default) or intl (www.cultbeauty.com, the international site, EUR default). Both take the same 12 currencies: GBP, EUR, USD, AUD, CHF, AED, SAR, ILS, HKD, SGD, JPY, CNY. Text is in English on both.",
    currencyDoc:
      "The currency, as Cult Beauty's currency selector offers it: GBP, EUR, USD, AUD, CHF, AED, SAR, ILS, HKD, SGD, JPY or CNY (default: GBP on gb, EUR on intl).",
    filters: {
      brand: ["CeraVe", "Brand, as Cult Beauty names it (exact): facets[filter=brand].options[].value."],
      skin_type: ["Dry", "Skin type as Cult Beauty lists it, e.g. Dry, Oily, Sensitive."],
      concern: ["Anti-Ageing", "Skin concern as Cult Beauty lists it, e.g. Anti-Ageing, Dry, Dullness."],
      spf: ["SPF 30+", "SPF content as Cult Beauty lists it, e.g. No SPF, SPF 15+, SPF 30+."],
      key_ingredient: ["Retinol", "Key ingredient as Cult Beauty lists it, e.g. Retinol, Hyaluronic Acid."],
      formulation: ["Vegan", "Formulation as Cult Beauty lists it, e.g. Vegan, Alcohol Free."],
      range: ["Advanced Snail 96", "A brand's product range as Cult Beauty lists it."],
    },
    filtersProse: "brand, skin type, concern, SPF content, key ingredient, formulation, a brand's product range",
    facetExample: "en_beauty_skinSubcategory_content",
    facetNote: "Facet names are as facets[].facet gives them (en_ on both sites).",
    listExamples: "a category (/skin-care), brand (/brands/cerave), sale or offer page (Black Friday: /black-friday-cyber-monday)",
    pathExample: "/skin-care, /brands/cerave or /black-friday-cyber-monday",
    landingSuffix: "shop-all",
    host: "www.cultbeauty.co.uk",
    offersNote: "Not available on intl (cultbeauty.com has no voucher-codes page): a 400, not charged; use market gb. ",
    captured: {
      search:
        "Captured 2026-11-26: PIXI Glow Tonic 250ml (SKU 11200055) at 12.6 GBP against an RRP of 18 (30% off) on cultbeauty.co.uk; on cultbeauty.com (intl) the same SKU was 14.21 EUR (RRP 20.3).",
      list: "Captured 2026-11-26: /black-friday-cyber-monday listed 10,050 products.",
      product:
        "Captured 2026-11-26: NARS Afterglow Lip Balm - Triple X (SKU 17661748) at 19.18 GBP against an RRP of 29.5 (35% off), 9 shade variants.",
      offers: "Captured 2026-11-26: 9 offers on cultbeauty.co.uk, with end times as given.",
      brands: "Captured 2026-11-26: 289 brands on cultbeauty.co.uk.",
    },
    examples: { query: "glow tonic", sku: "11200055", suggest: "olaplex" },
  });
}
