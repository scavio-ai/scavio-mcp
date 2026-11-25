import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { registerCtcBannerTools } from "./ctc-banners.js";

// SportChek: 8 tools on /api/v1/sportchek (search, list, product, reviews, suggestions, store, brands,
// categories), English only, prices in CAD, 1 credit per call. Shapes: ./ctc-banners.ts.

export function registerSportchekTools(server: McpServer, getClient: () => ScavioClient) {
  registerCtcBannerTools(server, getClient, {
    id: "sportchek",
    name: "SportChek",
    first: "SportChek (sportchek.ca, Canada's sporting goods retailer, a Canadian Tire Corporation banner)",
    french: false,
    feedback: "reviews",
    notAvailable:
      "Not available: choosing a store for price or stock, stores near a postal code, customer questions, the flyer, Triangle Rewards or CT Money prices, price history (poll and store the answers), UPC or barcodes (the site shows none), a French storefront, cart or checkout.",
    exampleQuery: "winter jacket",
    exampleCode: "84166659F",
    exampleList: "/en/sale-clearance/clearance.html",
    exampleStore: "272",
    exampleSuggest: "bauer",
    exampleBrand: "BAUER",
    captured: {
      search:
        "Captured 2026-11-25: \"winter jacket\" listed 664 products (28 pages); the first, a Ripzone Men's Berkley Quilted Parka Jacket, at 124.97 CAD with a was price of 249.99 and the badges BESTSELLER, TOPRATED and CLEARANCE.",
      list:
        "Captured 2026-11-25: the clearance page (/en/sale-clearance/clearance.html) sorted price_low listed 4656 products in 195 pages.",
      product:
        "Captured 2026-11-25: the Columbia Women's Amaze Puff Down Jacket (84166659F) at 206.24 CAD, no was price, price_message \"25% Off* - Discount Applied. See details.\", sale_ends December 1, 2026, 29 variants; assigned_store 237 (SC CORNWALL - BROOKDALE SQUARE, Cornwall, ON) held 48 units across the variants, units_online 3626.",
      feedback:
        "Captured 2026-11-25: the Columbia Women's Amaze Puff Down Jacket (84166659F) averaged 4.66 from 59 reviews (52 five-star, 40 recommend yes, 5 no).",
      store:
        "Captured 2026-11-25: store 272 (SC RICHMOND CENTRE, Richmond, BC) with 11 nearby stores, the nearest SC VANCOUVER - SW MARINE DRIVE at 5.62 km.",
      brands: "Captured 2026-11-25: 164 brands.",
      categories: "Captured 2026-11-25: 1033 categories under 10 top-level ones.",
    },
  });
}
