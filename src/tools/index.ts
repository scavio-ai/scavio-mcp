import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { env } from "../lib/env.js";

import { registerExtractTool } from "./extract.js";
import { registerCompanyTools } from "./company.js";
import { registerGoogleTools } from "./google.js";
import { registerChatgptTools, registerGeminiTools } from "./ai-chat.js";
import { registerYoutubeTools } from "./youtube.js";
import { registerTiktokTools } from "./tiktok.js";
import { registerInstagramTools } from "./instagram.js";
import { registerRedditTools } from "./reddit.js";
import { registerXTools } from "./x.js";
import { registerLinkedinTools } from "./linkedin.js";
import { registerThreadsTools } from "./threads.js";
import { registerKuaishouTools } from "./kuaishou.js";
import { registerAmazonTools } from "./amazon.js";
import { registerWalmartTools } from "./walmart.js";
import { registerEbayTools } from "./ebay.js";
import { registerTargetTools } from "./target.js";
import { registerHomeDepotTools } from "./homedepot.js";
import { registerCostcoTools } from "./costco.js";
import { registerHebTools } from "./heb.js";
import { registerKrogerTools } from "./kroger.js";
import { registerPublixTools } from "./publix.js";
import { registerIkeaTools } from "./ikea.js";
import { registerWayfairTools } from "./wayfair.js";
import { registerAshleyTools } from "./ashley.js";
import { registerMaisonsdumondeTools } from "./maisonsdumonde.js";
import { registerWilliamssonomaTools } from "./williamssonoma.js";
import { registerBedbathbeyondTools } from "./bedbathbeyond.js";
import { registerDecathlonTools } from "./decathlon.js";
import { registerSpecsTools } from "./specs.js";
import { registerLowesTools } from "./lowes.js";
import { registerAcehardwareTools } from "./acehardware.js";
import { registerTractorsupplyTools } from "./tractorsupply.js";
import { registerMichaelsTools } from "./michaels.js";
import { registerNikeTools } from "./nike.js";
import { registerStaplesTools } from "./staples.js";
import { registerSamsClubTools } from "./samsclub.js";
import { registerBjsTools } from "./bjs.js";
import { registerCanadianTireTools } from "./canadiantire.js";
import { registerSportchekTools } from "./sportchek.js";
import { registerMarksTools } from "./marks.js";
import { registerRonaTools } from "./rona.js";
import { registerDollarGeneralTools } from "./dollargeneral.js";
import { registerDollarTreeTools } from "./dollartree.js";
import { registerDiscountTireTools } from "./discounttire.js";
import { registerVevorTools } from "./vevor.js";
import { registerNellisTools } from "./nellis.js";
import { registerEstatesalesTools } from "./estatesales.js";
import { registerBringatrailerTools } from "./bringatrailer.js";
import { registerSephoraTools } from "./sephora.js";
import { registerUltaTools } from "./ulta.js";
import { registerDermstoreTools } from "./dermstore.js";
import { registerBathandbodyworksTools } from "./bathandbodyworks.js";
import { registerSpacenkTools } from "./spacenk.js";
import { registerLookfantasticTools } from "./lookfantastic.js";
import { registerCultbeautyTools } from "./cultbeauty.js";
import { registerYesstyleTools } from "./yesstyle.js";
import { registerNotinoTools } from "./notino.js";
import { registerDouglasTools } from "./douglas.js";
import { registerBootsTools } from "./boots.js";
import { registerAldiTools } from "./aldi.js";
import { registerInstacartTools } from "./instacart.js";
import { registerPcexpressTools } from "./pcexpress.js";
import { registerMicroCenterTools } from "./microcenter.js";
import { registerWalgreensTools } from "./walgreens.js";
import { registerCvsTools } from "./cvs.js";
import { registerWholeFoodsTools } from "./wholefoods.js";
import { registerHarborFreightTools } from "./harborfreight.js";
import { registerAutozoneTools } from "./autozone.js";
import { registerOreillyTools } from "./oreilly.js";
import { registerRockautoTools } from "./rockauto.js";
import { registerCarscomTools } from "./carscom.js";
import { registerAutotraderTools } from "./autotrader.js";
import { registerCargurusTools } from "./cargurus.js";
import { registerCarmaxTools } from "./carmax.js";
import { registerCarvanaTools } from "./carvana.js";
import { registerTruecarTools } from "./truecar.js";
import { registerEdmundsTools } from "./edmunds.js";
import { registerKbbTools } from "./kbb.js";
import { registerPetsmartTools } from "./petsmart.js";
import { registerPetcoTools } from "./petco.js";
import { registerIherbTools } from "./iherb.js";
import { registerChewyTools } from "./chewy.js";
import { registerMenardsTools } from "./menards.js";
import { registerNordstromTools } from "./nordstrom.js";
import { registerNordstromRackTools } from "./nordstromrack.js";
import { registerBestBuyTools } from "./bestbuy.js";
import { registerNeweggTools } from "./newegg.js";
import { registerTcgplayerTools } from "./tcgplayer.js";
import { registerNintendoTools } from "./nintendo.js";
import { registerHmTools } from "./hm.js";
import { registerZaraTools } from "./zara.js";
import { registerUniqloTools } from "./uniqlo.js";
import { registerAsosTools } from "./asos.js";
import { registerFashionnovaTools } from "./fashionnova.js";
import { registerGapTools } from "./gap.js";
import { registerZapposTools } from "./zappos.js";
import { registerVintedTools } from "./vinted.js";
import { registerMercariTools } from "./mercari.js";
import { registerDepopTools } from "./depop.js";
import { registerPoshmarkTools } from "./poshmark.js";
import { registerOfferupTools } from "./offerup.js";
import { registerThredupTools } from "./thredup.js";
import { registerMacysTools } from "./macys.js";
import { registerSaksTools } from "./saks.js";
import { registerKohlsTools } from "./kohls.js";
import { registerJcpenneyTools } from "./jcpenney.js";
import { registerDicksTools } from "./dicks.js";
import { registerFootlockerTools } from "./footlocker.js";
import { registerFanaticsTools } from "./fanatics.js";
import { registerAcademyTools } from "./academy.js";
import { registerReiTools } from "./rei.js";
import { registerQvcTools } from "./qvc.js";
import { registerBarnesandnobleTools } from "./barnesandnoble.js";
import { registerThriftbooksTools } from "./thriftbooks.js";
import { registerBelkTools } from "./belk.js";
import { registerAbercrombieTools } from "./abercrombie.js";
import { registerLlbeanTools } from "./llbean.js";
import { registerSweetwaterTools } from "./sweetwater.js";
import { registerKabumTools } from "./kabum.js";
import { registerMagaluTools } from "./magalu.js";
import { registerCasasbahiaTools } from "./casasbahia.js";
import { registerBuscapeTools } from "./buscape.js";
import { registerRdsaudeTools } from "./rdsaude.js";
import { registerReclameaquiTools } from "./reclameaqui.js";
import { registerLeroymerlinTools } from "./leroymerlin.js";
import { registerNaturaTools } from "./natura.js";
import { registerBoticarioTools } from "./boticario.js";
import { registerCentauroTools } from "./centauro.js";
import { registerEnjoeiTools } from "./enjoei.js";
import { registerAtacadaoTools } from "./atacadao.js";
import { registerCarrefourBrTools } from "./carrefourbr.js";
import { registerArgosTools } from "./argos.js";
import { registerMediaExpertTools } from "./mediaexpert.js";
import { registerActionTools } from "./action.js";
import { registerHemaTools } from "./hema.js";
import { registerCarrefourTools } from "./carrefour.js";
import { registerAllegroTools } from "./allegro.js";
import { registerBolcomTools } from "./bolcom.js";
import { registerOlxTools } from "./olx.js";
import { registerTrendyolTools } from "./trendyol.js";
import { registerMercadoLibreTools } from "./mercadolibre.js";
import { registerRakutenTools } from "./rakuten.js";
import { registerTiktokShopTools } from "./tiktok-shop.js";
import { registerBookingTools } from "./booking.js";
import { registerAirbnbTools } from "./airbnb.js";
import { registerVrboTools } from "./vrbo.js";
import { registerExpediaTools } from "./expedia.js";
import { registerTripadvisorTools } from "./tripadvisor.js";
import { registerYelpTools } from "./yelp.js";
import { registerZillowTools } from "./zillow.js";
import { registerRedfinTools } from "./redfin.js";
import { registerRealtorTools } from "./realtor.js";
import { registerRightmoveTools } from "./rightmove.js";
import { registerRentcomTools } from "./rentcom.js";
import { registerTruliaTools } from "./trulia.js";
import { registerStreeteasyTools } from "./streeteasy.js";
import { registerRentcafeTools } from "./rentcafe.js";
import { registerMovotoTools } from "./movoto.js";
import { registerHotpadsTools } from "./hotpads.js";
import { registerApartmentlistTools } from "./apartmentlist.js";
import { registerCompassTools } from "./compass.js";
import { registerAffordablehousingTools } from "./affordablehousing.js";
import { registerLennarTools } from "./lennar.js";
import { registerExtraspaceTools } from "./extraspace.js";
import { registerPublicstorageTools } from "./publicstorage.js";
import { registerUhaulTools } from "./uhaul.js";
import { registerIndeedTools } from "./indeed.js";
import { registerGlassdoorTools } from "./glassdoor.js";
import { registerAppStoreTools } from "./appstore.js";
import { registerGooglePlayTools } from "./googleplay.js";
import { registerG2Tools } from "./g2.js";
import { registerCapterraTools } from "./capterra.js";
import { registerTrustpilotTools } from "./trustpilot.js";
import { registerGoodreadsTools } from "./goodreads.js";
import { registerGoogleAdsTools } from "./googleads.js";
import { registerMetaAdsTools } from "./metaads.js";
import { registerSecTools } from "./sec.js";
import { registerCompaniesHouseTools } from "./companieshouse.js";
import { registerUsageTool } from "./usage.js";
import { applyChatgptProfile, CHATGPT_BROAD_PLATFORMS, CHATGPT_PLATFORMS } from "./chatgpt-app.js";
import type { RegisteredTool } from "@modelcontextprotocol/sdk/server/mcp.js";

type RegisterFn = (server: McpServer, getClient: () => ScavioClient) => void;

/**
 * Every registrable surface, keyed by platform. Iteration order here is the
 * order tools are registered, and therefore the order they appear in
 * tools/list — keep it stable so client-side tool caches stay stable.
 *
 * Keys match the platform keys in gtm/fanout-spec.json. Lookups are normalised
 * (case-insensitive, punctuation-insensitive), so `meta-ads`, `metaads` and
 * `META_ADS` all resolve to the same entry.
 *
 * `get_usage` is deliberately NOT in here: it reports the caller's own credit
 * balance, costs nothing, and is what every install guide tells a user to call
 * to verify the server works. It registers unconditionally.
 */
const PLATFORMS: Record<string, RegisterFn> = {
  // Core
  extract: registerExtractTool,
  company: registerCompanyTools,
  // Search
  google: registerGoogleTools,
  // AI assistants
  chatgpt: registerChatgptTools,
  gemini: registerGeminiTools,
  // Social and video
  youtube: registerYoutubeTools,
  tiktok: registerTiktokTools,
  instagram: registerInstagramTools,
  reddit: registerRedditTools,
  x: registerXTools,
  linkedin: registerLinkedinTools,
  threads: registerThreadsTools,
  kuaishou: registerKuaishouTools,
  // Retail and marketplaces
  amazon: registerAmazonTools,
  walmart: registerWalmartTools,
  ebay: registerEbayTools,
  target: registerTargetTools,
  homedepot: registerHomeDepotTools,
  costco: registerCostcoTools,
  heb: registerHebTools,
  kroger: registerKrogerTools,
  publix: registerPublixTools,
  ikea: registerIkeaTools,
  wayfair: registerWayfairTools,
  ashley: registerAshleyTools,
  maisonsdumonde: registerMaisonsdumondeTools,
  williamssonoma: registerWilliamssonomaTools,
  bedbathbeyond: registerBedbathbeyondTools,
  decathlon: registerDecathlonTools,
  specs: registerSpecsTools,
  lowes: registerLowesTools,
  acehardware: registerAcehardwareTools,
  tractorsupply: registerTractorsupplyTools,
  michaels: registerMichaelsTools,
  nike: registerNikeTools,
  staples: registerStaplesTools,
  samsclub: registerSamsClubTools,
  bjs: registerBjsTools,
  canadiantire: registerCanadianTireTools,
  sportchek: registerSportchekTools,
  marks: registerMarksTools,
  rona: registerRonaTools,
  dollargeneral: registerDollarGeneralTools,
  dollartree: registerDollarTreeTools,
  discounttire: registerDiscountTireTools,
  vevor: registerVevorTools,
  nellis: registerNellisTools,
  estatesales: registerEstatesalesTools,
  bringatrailer: registerBringatrailerTools,
  sephora: registerSephoraTools,
  ulta: registerUltaTools,
  dermstore: registerDermstoreTools,
  bathandbodyworks: registerBathandbodyworksTools,
  spacenk: registerSpacenkTools,
  lookfantastic: registerLookfantasticTools,
  cultbeauty: registerCultbeautyTools,
  yesstyle: registerYesstyleTools,
  notino: registerNotinoTools,
  douglas: registerDouglasTools,
  boots: registerBootsTools,
  aldi: registerAldiTools,
  instacart: registerInstacartTools,
  pcexpress: registerPcexpressTools,
  microcenter: registerMicroCenterTools,
  walgreens: registerWalgreensTools,
  cvs: registerCvsTools,
  wholefoods: registerWholeFoodsTools,
  harborfreight: registerHarborFreightTools,
  autozone: registerAutozoneTools,
  oreilly: registerOreillyTools,
  rockauto: registerRockautoTools,
  carscom: registerCarscomTools,
  autotrader: registerAutotraderTools,
  cargurus: registerCargurusTools,
  carmax: registerCarmaxTools,
  carvana: registerCarvanaTools,
  truecar: registerTruecarTools,
  edmunds: registerEdmundsTools,
  kbb: registerKbbTools,
  petsmart: registerPetsmartTools,
  petco: registerPetcoTools,
  iherb: registerIherbTools,
  chewy: registerChewyTools,
  menards: registerMenardsTools,
  nordstrom: registerNordstromTools,
  nordstromrack: registerNordstromRackTools,
  bestbuy: registerBestBuyTools,
  newegg: registerNeweggTools,
  tcgplayer: registerTcgplayerTools,
  nintendo: registerNintendoTools,
  hm: registerHmTools,
  zara: registerZaraTools,
  uniqlo: registerUniqloTools,
  asos: registerAsosTools,
  fashionnova: registerFashionnovaTools,
  gap: registerGapTools,
  zappos: registerZapposTools,
  vinted: registerVintedTools,
  mercari: registerMercariTools,
  depop: registerDepopTools,
  poshmark: registerPoshmarkTools,
  offerup: registerOfferupTools,
  thredup: registerThredupTools,
  macys: registerMacysTools,
  saks: registerSaksTools,
  kohls: registerKohlsTools,
  jcpenney: registerJcpenneyTools,
  dicks: registerDicksTools,
  footlocker: registerFootlockerTools,
  fanatics: registerFanaticsTools,
  academy: registerAcademyTools,
  rei: registerReiTools,
  qvc: registerQvcTools,
  barnesandnoble: registerBarnesandnobleTools,
  thriftbooks: registerThriftbooksTools,
  belk: registerBelkTools,
  abercrombie: registerAbercrombieTools,
  llbean: registerLlbeanTools,
  sweetwater: registerSweetwaterTools,
  kabum: registerKabumTools,
  magalu: registerMagaluTools,
  casasbahia: registerCasasbahiaTools,
  buscape: registerBuscapeTools,
  rdsaude: registerRdsaudeTools,
  reclameaqui: registerReclameaquiTools,
  leroymerlin: registerLeroymerlinTools,
  natura: registerNaturaTools,
  boticario: registerBoticarioTools,
  centauro: registerCentauroTools,
  enjoei: registerEnjoeiTools,
  atacadao: registerAtacadaoTools,
  carrefourbr: registerCarrefourBrTools,
  argos: registerArgosTools,
  mediaexpert: registerMediaExpertTools,
  action: registerActionTools,
  hema: registerHemaTools,
  carrefour: registerCarrefourTools,
  allegro: registerAllegroTools,
  bolcom: registerBolcomTools,
  olx: registerOlxTools,
  trendyol: registerTrendyolTools,
  mercadolibre: registerMercadoLibreTools,
  rakuten: registerRakutenTools,
  "tiktok-shop": registerTiktokShopTools,
  // Travel and local
  booking: registerBookingTools,
  airbnb: registerAirbnbTools,
  vrbo: registerVrboTools,
  expedia: registerExpediaTools,
  tripadvisor: registerTripadvisorTools,
  yelp: registerYelpTools,
  // Real estate
  zillow: registerZillowTools,
  redfin: registerRedfinTools,
  realtor: registerRealtorTools,
  rightmove: registerRightmoveTools,
  rentcom: registerRentcomTools,
  trulia: registerTruliaTools,
  streeteasy: registerStreeteasyTools,
  rentcafe: registerRentcafeTools,
  movoto: registerMovotoTools,
  hotpads: registerHotpadsTools,
  apartmentlist: registerApartmentlistTools,
  compass: registerCompassTools,
  affordablehousing: registerAffordablehousingTools,
  lennar: registerLennarTools,
  extraspace: registerExtraspaceTools,
  publicstorage: registerPublicstorageTools,
  uhaul: registerUhaulTools,
  // Jobs and employer data
  indeed: registerIndeedTools,
  glassdoor: registerGlassdoorTools,
  // App stores
  appstore: registerAppStoreTools,
  googleplay: registerGooglePlayTools,
  // Software reviews
  g2: registerG2Tools,
  capterra: registerCapterraTools,
  // Business reviews
  trustpilot: registerTrustpilotTools,
  // Books
  goodreads: registerGoodreadsTools,
  // Ad libraries
  googleads: registerGoogleAdsTools,
  metaads: registerMetaAdsTools,
  // Company and financial filings
  sec: registerSecTools,
  companieshouse: registerCompaniesHouseTools,
};

export const PLATFORM_KEYS = Object.keys(PLATFORMS);

/**
 * What registers when SCAVIO_PLATFORMS is unset.
 *
 * Registering everything is not an option any more. The full surface is 408
 * tools, which serialises to 3096KB of tools/list (measured with
 * `npm run toolslist`, not estimated) — roughly 90k tokens pushed into the
 * context of EVERY session before the user has typed anything, and past the
 * hard tool-count ceiling some clients enforce. The default set below is 143
 * tools, 114KB (0.20.0: TikTok, YouTube, Reddit and X gained 19 tools; 0.21.0:
 * Extract gained map, crawl and batch, 7 tools; 0.22.0: Instagram gained 8; 0.23.0: google_custom_search; 0.24.0 added the opt-in chatgpt and gemini platforms).
 *
 * The default is therefore exactly what 0.12.x registered, plus extract:
 * upgrading must never silently remove a tool someone already depends on. A
 * user who had TikTok or LinkedIn working yesterday still has it today, and
 * the context cost is unchanged from the version they were already running.
 * extract joins them because it is a single tool and the read-any-page
 * primitive an agent reaches for in almost every session. company (0.50.0)
 * joins for the same reason: one tool, and the step after google_maps_search,
 * which is already in the default set (place_id -> emails, phones, owner).
 *
 * The 22 platforms added in 0.13.0 are opt-in via SCAVIO_PLATFORMS — growth
 * goes behind the flag, the existing contract does not move.
 */
export const DEFAULT_PLATFORMS = [
  "extract",
  "company",
  "google",
  "youtube",
  "amazon",
  "walmart",
  "reddit",
  "tiktok",
  "tiktok-shop",
  "instagram",
  "x",
  "linkedin",
];

/** Names users reasonably type that are not the canonical key. */
const ALIASES: Record<string, string> = {
  twitter: "x",
  metaadlibrary: "metaads",
  facebookads: "metaads",
  googleadstransparency: "googleads",
};

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

const CANONICAL_BY_NORMALIZED = new Map<string, string>();
for (const key of PLATFORM_KEYS) CANONICAL_BY_NORMALIZED.set(normalize(key), key);
for (const [alias, key] of Object.entries(ALIASES)) CANONICAL_BY_NORMALIZED.set(normalize(alias), key);

const warned = new Set<string>();
function warnOnce(message: string): void {
  if (warned.has(message)) return;
  warned.add(message);
  // stderr only — stdout is the JSON-RPC stream.
  console.error(message);
}

/**
 * Turn a SCAVIO_PLATFORMS value into the canonical platform keys to register.
 *
 * Accepts a comma-separated list of platform keys, plus three keywords:
 *   all      — every platform (1421 tools)
 *   default  — expands to DEFAULT_PLATFORMS, so `default,sec,g2` is additive
 *   none     — no platform tools at all, leaving only get_usage
 *
 * Unknown entries are warned about and skipped rather than fatal: a typo in one
 * key must not take down a server the user has already wired into a client.
 * A list that is entirely typos falls back to the default for the same reason.
 * Always returned in PLATFORMS order, never in the order the user typed.
 */
export function resolvePlatforms(raw: string | undefined | null): string[] {
  if (raw === undefined || raw === null || raw.trim() === "") return [...DEFAULT_PLATFORMS];

  const selected = new Set<string>();
  const unknown: string[] = [];
  let explicitNone = false;

  for (const token of raw.split(",")) {
    const key = normalize(token);
    if (key === "") continue;
    if (key === "all" || key === "*") return [...PLATFORM_KEYS];
    if (key === "none") {
      explicitNone = true;
      continue;
    }
    if (key === "default") {
      for (const d of DEFAULT_PLATFORMS) selected.add(d);
      continue;
    }
    const canonical = CANONICAL_BY_NORMALIZED.get(key);
    if (canonical) selected.add(canonical);
    else unknown.push(token.trim());
  }

  if (unknown.length > 0) {
    warnOnce(
      `[scavio-mcp] Ignoring unknown SCAVIO_PLATFORMS ${unknown.length === 1 ? "value" : "values"}: ${unknown.join(", ")}. ` +
        `Known platforms: ${PLATFORM_KEYS.join(", ")} (or "all").`,
    );
  }

  if (selected.size === 0) {
    if (explicitNone) return [];
    warnOnce(`[scavio-mcp] SCAVIO_PLATFORMS matched no known platform; falling back to the default set: ${DEFAULT_PLATFORMS.join(", ")}.`);
    return [...DEFAULT_PLATFORMS];
  }

  return PLATFORM_KEYS.filter((key) => selected.has(key));
}

/** Words in tool names whose display form is not plain title case. */
const TITLE_WORDS: Record<string, string> = {
  tiktok: "TikTok",
  youtube: "YouTube",
  linkedin: "LinkedIn",
  ebay: "eBay",
  heb: "HEB",
  lowes: "Lowe's",
  acehardware: "Ace Hardware",
  tractorsupply: "Tractor Supply",
  sams: "Sam's",
  aldi: "ALDI",
  cvs: "CVS",
  petsmart: "PetSmart",
  iherb: "iHerb",
  sec: "SEC",
  g2: "G2",
  ai: "AI",
  url: "URL",
  chatgpt: "ChatGPT",
  rentcom: "Rent.com",
  streeteasy: "StreetEasy",
  rentcafe: "RentCafe",
  truecar: "TrueCar",
  kbb: "KBB",
  hotpads: "HotPads",
  apartmentlist: "Apartment List",
  affordablehousing: "AffordableHousing.com",
  extraspace: "Extra Space",
  publicstorage: "Public Storage",
  estatesales: "EstateSales.net",
  bathandbodyworks: "Bath & Body Works",
  bjs: "BJ's",
  rei: "REI",
  qvc: "QVC",
  barnesandnoble: "Barnes & Noble",
  thriftbooks: "ThriftBooks",
  uhaul: "U-Haul",
  williamssonoma: "Williams-Sonoma",
  belk: "Belk",
  abercrombie: "Abercrombie & Fitch",
  llbean: "L.L.Bean",
  sweetwater: "Sweetwater",
  bedbathbeyond: "Bed Bath & Beyond",
  kabum: "KaBuM!",
  magalu: "Magazine Luiza",
  casasbahia: "Casas Bahia",
  buscape: "Buscape + Zoom",
  rdsaude: "Drogasil + Droga Raia",
  reclameaqui: "Reclame Aqui",
  leroymerlin: "Leroy Merlin",
  natura: "Natura",
  boticario: "O Boticario + Eudora",
  centauro: "Centauro",
  enjoei: "Enjoei",
  atacadao: "Atacadao",
  carrefourbr: "Carrefour Brasil",
};

/** `get_tiktok_user_posts` -> `Get TikTok User Posts`. */
export function toolTitle(name: string): string {
  return name
    .split("_")
    .map((w) => TITLE_WORDS[w] ?? w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/**
 * Every Scavio tool reads public data and changes nothing, so one annotation
 * set covers all of them. The Claude, ChatGPT and Microsoft connector
 * directories reject a server whose tools lack a title and these hints.
 * openWorldHint is true because the data comes from external sites.
 */
const READ_ONLY_ANNOTATIONS = {
  readOnlyHint: true,
  destructiveHint: false,
  openWorldHint: true,
} as const;

/**
 * The exceptions to "reads and changes nothing": starting a crawl or batch
 * creates a server-side job (not idempotent unless idempotency_key is set), and
 * cancelling one stops it for good. Still no change to any external site.
 */
const ANNOTATION_OVERRIDES: Record<string, { readOnlyHint?: boolean; destructiveHint?: boolean; idempotentHint?: boolean }> = {
  crawl_website: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
  batch_extract: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
  cancel_crawl: { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
  cancel_batch: { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
};

/**
 * Wrap the server so every tool() call is annotated at registration, instead
 * of editing 266 call sites. A tool added later picks this up automatically.
 */
function annotating(server: McpServer, captured?: Map<string, RegisteredTool>): McpServer {
  return new Proxy(server, {
    get(target, prop, receiver) {
      if (prop !== "tool") return Reflect.get(target, prop, receiver);
      return (name: string, ...rest: unknown[]) => {
        const registered: ReturnType<McpServer["tool"]> = Reflect.apply(target.tool, target, [name, ...rest]);
        const title = toolTitle(name);
        registered.update({ title, annotations: { title, ...READ_ONLY_ANNOTATIONS, ...ANNOTATION_OVERRIDES[name] } });
        captured?.set(name, registered);
        return registered;
      };
    },
  });
}

/**
 * Register the allowlisted platform tools plus get_usage.
 *
 * `platformsRaw` lets the HTTP transport pass a per-request override (header or
 * query param), since a hosted remote has no per-user env var to read.
 */
export function registerAllTools(
  server: McpServer,
  getClient: () => ScavioClient,
  platformsRaw: string | undefined = env.SCAVIO_PLATFORMS,
): string[] {
  const platforms = resolvePlatforms(platformsRaw);
  const annotated = annotating(server);
  for (const key of platforms) PLATFORMS[key](annotated, getClient);
  registerUsageTool(annotated, getClient);
  return platforms;
}

/**
 * Register the fixed tool set served at /chatgpt (see chatgpt-app.ts). Ignores
 * SCAVIO_PLATFORMS and per-connection overrides: the directory listing is
 * reviewed against one tool set, so the endpoint always serves exactly that.
 */
export function registerChatgptAppTools(server: McpServer, getClient: () => ScavioClient): void {
  const captured = new Map<string, RegisteredTool>();
  const annotated = annotating(server, captured);
  for (const key of CHATGPT_PLATFORMS) PLATFORMS[key](annotated, getClient);
  registerUsageTool(annotated, getClient);
  const broad = new Map<string, RegisteredTool>();
  const annotatedBroad = annotating(server, broad);
  for (const key of CHATGPT_BROAD_PLATFORMS) PLATFORMS[key](annotatedBroad, getClient);
  applyChatgptProfile(captured, broad);
}
