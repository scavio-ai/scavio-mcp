import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// Shapes mirror backend/src/routes/mcmaster.ts (McMaster-Carr, mcmaster.com, the US industrial-supply catalog; one US
// storefront in USD, so the route's country input, which only accepts us, is left out). Rules the backend enforces and
// zod here does not: product takes part_number or url; search takes query or category, not both. No zod `.default()`:
// the MCP SDK would post a defaulted field on every call.

const SITE =
  "McMaster-Carr (mcmaster.com, the US industrial-supply catalog), United States, prices in USD as the site shows them to a visitor who is not signed in";
const ONE = "Costs 1 credit (credits_used is what was charged). Failed upstream calls and refused inputs are not charged; a not-found is charged.";
const CATALOG =
  "McMaster-Carr sells under its own part numbers: no manufacturer part numbers or UPCs are shown, and it has no reviews, stores, store stock or deals. CAD and PDF files are not returned.";

export function registerMcmasterTools(server: McpServer, getClient: () => ScavioClient) {
  const post = (endpoint: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(`/api/v1/mcmaster/${endpoint}`, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "get_mcmaster_product",
    `One part of ${SITE}, by part number or part link: country, currency, part_number, requested_part_number, title, name, detail, url, product_family, part_family, catalog_page, catalog_status, unit_of_measure (Each or Pack of N), package_quantity, price, price_text and price_unit (the price as shown, for one order unit), package_price (that price when sold in a pack), unit_price (the price of one piece: the price when sold Each, else the per-piece price the site shows), per_piece_price_text, price_levels [{quantity, price, price_text}] (quantity breaks when listed), delivery_message, stock_message (the delivery promise shown; no stock counts are published), discontinued, discontinued_message, replacement_part_number, specifications [{name, value, group}], compliance {country_of_origin, dfars, eccn, schedule_b, rohs, reach, usmca_qualifying}, images, breadcrumbs [{name, slug, url}], compatible_products [{group, name, part_number, description, price, price_text, unit_of_measure, product_count}] and note. When the specification table does not arrive, specifications and compliance are null and the note says so. ${CATALOG} Captured 2026-11-28: 91251A540, a black-oxide alloy steel socket head screw, 12.42 USD per pack of 50 (0.25 USD per piece). ${ONE} Usually 8 to 30 s; a part number the site does not know is not answered (an unbilled error after about 2 minutes); allow a client timeout of at least 180 s.`,
    {
      part_number: z.string().min(3).max(20).optional()
        .describe("A McMaster-Carr part number (items[].part_number of search_mcmaster), e.g. '91251A540'. Send part_number or url."),
      url: z.string().max(300).optional().describe("Or a mcmaster.com part link (https://www.mcmaster.com/<part number>/)."),
    },
    post("product"),
  );

  server.tool(
    "search_mcmaster",
    `A keyword page or a category page of ${SITE}, by query or category slug (one of them). Returns country, currency, query, category, url, redirected_to ({type: product, part_number, url} when the keywords are a part number; product then holds that part), heading, total (the products the site counts for the page), rows_on_page, offset, per_page, count, has_more, items [{position, part_number, url, currency, presentation, groups, price, price_basis (Pkg. or Each, as the table labels the price), package_quantity, package_price, unit_price (for Pkg. rows package_price / package_quantity, computed by Scavio), prices [{label, price}] (further price columns), specs [{name, value}]}] (the part-number rows of the product tables the page opens on load, per_page at a time), breadcrumbs, product_families [{name, product_count, slug, url}] (a slug is the category input of the next call), related_categories, presentations [{name, row_count}], facets [{name, value_count, values [{value, product_count, slug}]}] (up to 50 values each) and note. Search-box suggestions are not returned. ${CATALOG} Captured 2026-11-28: hose clamps opened Hose and Tube Clamps, 6,125 products in 39 families, the first row a pack of 10 worm-drive clamps at 21.61 USD (2.16 USD per piece); the worm-drive clamps family held 327. ${ONE} Listing pages are large and slow: usually 10 to 80 s, up to about 240 s; allow a client timeout of at least 300 s. The largest families (socket head screws, about 29,000 products on one page) can exceed the time limit: narrow them with a family tile or facet slug.`,
    {
      query: z.string().min(1).max(120).optional()
        .describe("Keywords as typed into the McMaster-Carr search box, e.g. 'hose clamps' (a part number answers with that part). Send query or category."),
      category: z.string().min(1).max(600).optional()
        .describe("Or a category slug: categories[].slug of get_mcmaster_categories, or a result's product_families[].slug, related_categories[].slug, facets[].values[].slug or breadcrumbs[].slug (e.g. 'hose-clamps/worm-drive-clamps~~'), or a mcmaster.com/products/ link."),
      per_page: z.number().int().min(1).max(100).optional().describe("Part-number rows per answer, 1 to 100 (default 50)."),
      offset: z.number().int().min(0).max(20000).optional()
        .describe("Rows to skip on the page (default 0): the next answer starts at offset + count while has_more is true."),
    },
    post("search"),
  );

  server.tool(
    "get_mcmaster_categories",
    `The top level of the catalogue of ${SITE}, as the home page lists it: country, currency, count, categories [{name, slug, url}] and note; slug is the category input of search_mcmaster, which returns the deeper levels (product families with product counts). Captured 2026-11-28: 27 categories. ${ONE} Usually 3 to 40 s; allow a client timeout of at least 180 s.`,
    {},
    post("categories"),
  );
}
