import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { registerCtcBannerTools } from "./ctc-banners.js";

// Mark's: 8 tools on /api/v1/marks (search, list, product, questions, suggestions, store, brands,
// categories), prices in CAD, 1 credit per call. language fr (L'Equipeur) on search, list, product,
// brands and categories; questions, suggestions and store are English. Shapes: ./ctc-banners.ts.

export function registerMarksTools(server: McpServer, getClient: () => ScavioClient) {
  registerCtcBannerTools(server, getClient, {
    id: "marks",
    name: "Mark's",
    first:
      "Mark's (marks.com, the Canadian workwear, casual clothing and footwear retailer, a Canadian Tire Corporation banner; L'Equipeur in French)",
    french: true,
    feedback: "questions",
    notAvailable:
      "Not available: choosing a store for price or stock, stores near a postal code, customer reviews, the flyer, Triangle Rewards or CT Money prices, price history (poll and store the answers), UPC or barcodes (the site shows none), cart or checkout.",
    exampleQuery: "work boots",
    exampleCode: "75983776F",
    exampleList: "/en/cat/work-boots-shoes-DC3000008.html",
    exampleStore: "589",
    exampleSuggest: "dakota",
    exampleBrand: "Dakota Workpro Series",
    captured: {
      search:
        "Captured 2026-11-25: \"work boots\" listed 1001 products (42 pages); the first, Aggressor Men's Lynx II Steel Toe Steel Plate 6 Inch Leather Work Boots, at 69.99 CAD with a was price of 99.99, sale_ends November 25, 2026. With language fr, \"bottes de travail\" listed 707 products from L'Equipeur in French.",
      list:
        "Captured 2026-11-25: the work boots and shoes category (/en/cat/work-boots-shoes-DC3000008.html) listed 532 products, 12 a page (45 pages).",
      product:
        "Captured 2026-11-25: Dakota WorkPro Series 6114 work boots (75983776F) at 124.99 CAD with a was price of 199.99, sale_ends November 25, 2026, 15 variants (colour, size and width); assigned_store 114 (Marche Central, Montreal, QC). The same code with language fr returned the L'Equipeur page: the same 124.99 CAD and was price, a French title, assigned_store 115 (Sherbrooke, QC).",
      feedback:
        "Captured 2026-11-25: Aggressor Men's Lynx II work boots (75984589F) had 4 questions, 3 of them answered.",
      store:
        "Captured 2026-11-25: store 589 (Leamington, ON) with 47 nearby stores, the nearest Essex at 23.19 km.",
      brands: "Captured 2026-11-25: 113 brands.",
      categories: "Captured 2026-11-25: 269 categories under 11 top-level ones.",
    },
  });
}
