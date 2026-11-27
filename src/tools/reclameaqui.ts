import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// Shapes mirror backend/src/routes/reclameaqui.ts (Reclame Aqui, reclameaqui.com.br, Brazil's company complaint and
// reputation site; Brazil only, pt-BR, no prices). Rules the backend enforces and zod here does not: company takes
// exactly one of shortname or url; complaints exactly one of company_id or shortname; complaint url, or company with
// complaint_id; segment ranking main_segment with segment, or url; complaint lists reach offset 500 per filter
// combination. No zod `.default()`: the MCP SDK would post a defaulted field on every call.

const SITE = "Reclame Aqui (reclameaqui.com.br, Brazil's company complaint and reputation site), Portuguese text as published";
const ONE =
  "1 credit (credits_used is what was charged). Refused inputs and upstream failures are not charged; a not-found is charged. Allow a client timeout of at least 120 s.";
const PII =
  "Consumer names, emails, IPs, user ids, phones and cities are never returned (the consumer's state is); a consumer's name in a company's greeting is replaced with [nome]. Every answer carries note: text is as the consumer published it, with the names that can be detected removed.";
const ITEM =
  "complaints [{position, id (what get_reclameaqui_complaint takes, with company), legacy_id, title, excerpt, url, status (unanswered, answered, resolved, not_resolved), site_status, solved, evaluated, score (0 to 10, once evaluated), would_deal_again, evaluation (the consumer's closing words), created, modified, first_answer_at, interaction_count, category {id, name}, product {id, name}, problem {id, name}, other_product, other_problem, special (blackfriday ...), state, company {id, shortname, name}, frozen, in_moderation}]";

const shortname = z.string().min(1).max(300);
const pageSize = z.union([z.literal(5), z.literal(10)]).optional()
  .describe("Complaints per page: 5 or 10 (default 10), the two sizes Reclame Aqui serves.");
const listPage = z.number().int().min(1).max(101).optional()
  .describe("Page, 1-based (default 1). Reclame Aqui serves up to offset 500 per filter combination: page 51 at 10 a page, page 101 at 5. A later page is refused before any call.");
const filterId = (what: string, list: string) => z.string().min(1).max(40).optional()
  .describe(`Only complaints with this ${what}: an id from filters.${list} of an answer, e.g. '0000000000000003'.`);

export function registerReclameaquiTools(server: McpServer, getClient: () => ScavioClient) {
  const post = (endpoint: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(`/api/v1/reclameaqui/${endpoint}`, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "search_reclameaqui_companies",
    `Find companies on ${SITE} with the site's own company search (about 7 matches, no paging): query, count and companies [{position, id (what get_reclameaqui_complaints takes), shortname (what get_reclameaqui_company takes), name, company_name, fantasy_name, url, reputation (RA1000, GREAT, GOOD, REGULAR, BAD, NOT_RECOMMENDED, NO_INDEX ...), final_score, solved_percent, complaints_6_months, cnpj, documents, city, state, website, logo, main_segment, segment, verified, previous_names, sub_brands}]. Reclame Aqui's own API (RA API / Hugme) is paid and covers only a company's own complaints. Captured 2026-11-27: nubank matched 6 companies, the first Nubank (id 88850), RA1000 with a final score of 8.8, 93.2% solved and 56825 complaints in 6 months. ${ONE}`,
    {
      query: z.string().min(2).max(100)
        .describe("Company name or brand, e.g. 'nubank'."),
    },
    post("company-search"),
  );

  server.tool(
    "get_reclameaqui_company",
    `One company's reputation on ${SITE} by shortname or link: id, legacy_id, shortname, name, url, known_as, description, cnpj, cnpj_validated, plan, account_status, verified, website, logo, city, state, phones [{number, country_code}] (the company's published numbers), social_networks, on_platform_since, time_on_platform, page_views, segments {main, secondary [{id, shortname, name, complaints, has_page}]}, reputation [for each of the 5 periods (6_months, 12_months, last_year, year_before_last, 3_years): period, site_period, main, start, end, complaints, answered, unanswered, ratings, answered_percent, solved_percent, would_do_business_again_percent, consumer_score, final_score, average_answer_time_seconds, status (RA1000 ... NOT_RECOMMENDED), status_label], main_problems [{id, name, complaints, percent}] (ids work as the complaints category filter), segment_ranking {position, list (best or worst), segment_name, main_segment, segment}, reputation_history [{month, status}] (6 months), notice {title, text} (a notice the company posted) and related_companies. An unknown shortname is a charged not-found. Captured 2026-11-27: Nubank over 6 months (2026-05-01 to 2026-10-31) had 56825 complaints, 100% answered, 93.2% solved, 81.5% would do business again, final score 8.8, RA1000. ${ONE}`,
    {
      shortname: shortname.optional()
        .describe("A company shortname (shortname of search_reclameaqui_companies; the part after /empresa/ in a reclameaqui.com.br link), e.g. 'nubank'. Send shortname or url."),
      url: z.string().min(10).max(300).optional()
        .describe("Or a reclameaqui.com.br/empresa/<shortname>/ link."),
    },
    post("company"),
  );

  server.tool(
    "get_reclameaqui_complaints",
    `One company's complaints on ${SITE}, newest first (the site has no other order), with the site's tabs (status), category / product / problem filters, Black Friday purchases and a keyword inside the company; 5 or 10 a page, up to 51 pages of 10 per filter combination, with the exact total: company_id, shortname, company_name, status, category, product, problem, black_friday, query, sort (newest), page, page_size, total, total_pages, reachable_pages, count, ${ITEM}, filters {categories, products, problems [{id, name, complaints}]} (send the ids back as filters) and note. ${PII} Captured 2026-11-27: Nubank (88850) had 164495 resolved complaints, 51 pages of 10 reachable. Credits: 1 by company_id; 2 by shortname (the id is looked up first), 3 if the search misses it and the company page is read (credits_used is what was charged). Refused inputs and upstream failures are not charged; a not-found is charged. Allow a client timeout of at least 120 s.`,
    {
      company_id: z.string().min(1).max(40).optional()
        .describe("The company id (id of search_reclameaqui_companies or get_reclameaqui_company), e.g. '88850'. 1 credit. Send company_id or shortname."),
      shortname: shortname.optional()
        .describe("Or the company shortname, e.g. 'nubank': looked up first, 2 credits."),
      status: z.enum(["latest", "unanswered", "answered", "evaluated", "resolved", "not_resolved"]).optional()
        .describe("latest (default, every complaint), unanswered, answered (answered, not yet evaluated), evaluated, resolved or not_resolved (as the consumer evaluated it): the site's complaint tabs."),
      category: filterId("category", "categories"),
      product: filterId("product", "products"),
      problem: filterId("problem", "problems"),
      black_friday: z.boolean().optional()
        .describe("Only complaints the consumer marked as Black Friday purchases."),
      query: z.string().min(1).max(100).optional()
        .describe("Only this company's complaints that match these words, e.g. 'cartão bloqueado'."),
      page: listPage,
      page_size: pageSize,
    },
    post("complaints"),
  );

  server.tool(
    "get_reclameaqui_complaint",
    `One complaint on ${SITE} with its whole thread, by link, or company with complaint_id: id, legacy_id, title, text, url, status, site_status, solved, evaluated, score, would_deal_again, created, category {id, name}, problem {id, name}, product {name}, special, state, company {id, shortname, name, url}, segment_ranking, interaction_count, interactions [{position, id, type (company_answer, consumer_reply, company_reply, final_evaluation), site_type, author (company or consumer), created, text}], names_masked, similar [{id, title, url, created, status}] and note. ${PII} An unknown complaint is a charged not-found. Captured 2026-11-27: a Nubank complaint about a card limit, resolved with a score of 10, had 2 interactions starting with the company's answer. ${ONE}`,
    {
      url: z.string().min(10).max(600).optional()
        .describe("A complaint link (url of a complaints answer). Send url, or company with complaint_id."),
      company: z.string().min(1).max(120).optional()
        .describe("The company shortname, with complaint_id, e.g. 'nubank'."),
      complaint_id: z.string().length(16).optional()
        .describe("The 16-character complaint id (id of a complaints answer), with company, e.g. 'NhIy-6O6osFhQdJ-'."),
    },
    post("complaint"),
  );

  server.tool(
    "search_reclameaqui_complaints",
    `Complaints across every company on ${SITE} that match some words, 5 or 10 a page, up to 51 pages of 10: query, page, page_size, total, total_pages, reachable_pages, count, ${ITEM}, companies [{id, shortname, name, complaints}] (the companies the matches are about) and note. ${PII} Captured 2026-11-27: iphone quebrado matched 3774 complaints about 50 companies, Apple with 604 of them. ${ONE}`,
    {
      query: z.string().min(1).max(100)
        .describe("Words to find in complaints across every company, e.g. 'iphone quebrado'."),
      page: listPage,
      page_size: pageSize,
    },
    post("complaint-search"),
  );

  server.tool(
    "get_reclameaqui_rankings",
    `The ${SITE} site-wide company rankings: 11 lists of 20 as the site shows them (best_resolution_rate, would_do_business_again, best_rating, most_resolved_30_days, most_resolved_6_months, most_complained_yesterday, most_complained_7_days, most_complained_30_days, most_complained_6_months, worst (worst companies of the last 30 days), newly_registered): list, count and lists [{list, name (the site's title), period, url, count, companies [{position, name, shortname, url, logo, reputation_label, value (the list's measure: percent, score or complaints), value_text}]}]. Captured 2026-11-27: most_complained_30_days (Mais reclamadas nos últimos 30 dias) listed 20 companies. ${ONE}`,
    {
      list: z.enum([
        "best_resolution_rate",
        "would_do_business_again",
        "best_rating",
        "most_resolved_30_days",
        "most_resolved_6_months",
        "most_complained_yesterday",
        "most_complained_7_days",
        "most_complained_30_days",
        "most_complained_6_months",
        "worst",
        "newly_registered",
      ]).optional()
        .describe("One of the 11 ranking lists. Leave out for all 11."),
    },
    post("rankings"),
  );

  server.tool(
    "get_reclameaqui_segments",
    `Every ranked segment of ${SITE}, for get_reclameaqui_segment_ranking: main_segments, count and segments [{main_segment, main_segment_name, segment, name, url}]. Captured 2026-11-27: 165 segments under 15 main segments. ${ONE}`,
    {},
    post("segments"),
  );

  server.tool(
    "get_reclameaqui_segment_ranking",
    `The best and worst companies of one ${SITE} segment, as the segment page ranks them. Page 1: best and worst, 10 each; page 2 and on: the next 10 best. main_segment, segment, url, page, segment_name, main_segment_name, best {total, pages, count, companies}, worst {total, pages, count, companies} (page 1 only, else null) and note; companies [{position, shortname, name, url, website, logo, verified, reputation, final_score, solved_percent, answered_percent, complaints, solved_complaints, unsolved_complaints, balance}]. An unknown segment is a charged not-found. Captured 2026-11-27: Bancos Digitais (bancos-e-financeiras) ranked 40 companies best, InfinitePay first, RA1000. ${ONE}`,
    {
      main_segment: z.string().min(1).max(100).optional()
        .describe("Main segment shortname (main_segment of get_reclameaqui_segments), e.g. 'bancos-e-financeiras'. Send main_segment with segment, or url."),
      segment: z.string().min(1).max(100).optional()
        .describe("Segment shortname (segment of get_reclameaqui_segments), e.g. 'bancos-digitais'."),
      url: z.string().min(10).max(300).optional()
        .describe("Or a reclameaqui.com.br/segmentos/<main>/<segment>/ link."),
      page: z.number().int().min(1).max(100).optional()
        .describe("Page of the best list, 10 a page (default 1). Page 1 also carries the 10 worst."),
    },
    post("segment-ranking"),
  );
}
