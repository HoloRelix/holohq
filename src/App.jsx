import React, { useState, useRef, useCallback, useMemo, useLayoutEffect, useEffect } from "react";
import Papa from "papaparse";
import {
  Sparkles, Upload, Plus, Trash2, TrendingUp, TrendingDown, Download,
  Tag, Settings2, Printer, ArrowLeft, CheckSquare, Square, Image as ImageIcon,
  X, ChevronRight, Home as HomeIcon, Search, Layers, Compass, Wrench,
  ShoppingBag, User, Calculator as CalcIcon, ArrowLeftRight, Loader2, Wallet,
  ShieldCheck, XCircle, Camera, Bell, Receipt, Award, Users, CreditCard, Heart, Check,
  Repeat, LineChart, ScanSearch, FileCheck2, CloudUpload, FileText, Clock, RefreshCw, GripVertical,
  Share2, Sun, Moon, Wifi, WifiOff, Send, Gift, FileSpreadsheet, Zap, ChevronDown, Play, SkipForward
} from "lucide-react";

/* ---------------- shared data + helpers ---------------- */

function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) { h = (h << 5) - h + s.charCodeAt(i); h |= 0; }
  return Math.abs(h);
}

const CONDITION_MULT = {
  "Raw NM": 1, "Raw LP": 0.82, "Raw MP": 0.6, "Raw HP": 0.38,
  "PSA 10": 3.4, "PSA 9": 2.05, "PSA 8": 1.4, "PSA 7": 1.05,
  "BGS Black Label": 4.5, "BGS 10": 3.7, "BGS 9.5": 2.6, "BGS 9": 1.9,
  "CGC Pristine": 3.9, "CGC 10": 3.1, "CGC 9": 1.75, "CGC 8": 1.25,
};
const CONDITIONS = Object.keys(CONDITION_MULT);

// ---- condition/grade chip groups for the price chart's grade selector ----
// Raw condition scale (NM/LP/MP/HP) applies to Pokémon & One Piece cards;
// the graded scale applies across every category.
const RAW_CONDITIONS = [
  { key: "Raw NM", label: "NM" },
  { key: "Raw LP", label: "LP" },
  { key: "Raw MP", label: "MP" },
  { key: "Raw HP", label: "HP" },
];
const GRADED_CONDITIONS = [
  { key: "PSA 10", label: "PSA 10" },
  { key: "PSA 9", label: "PSA 9" },
  { key: "PSA 8", label: "PSA 8" },
  { key: "PSA 7", label: "PSA 7" },
  { key: "BGS Black Label", label: "BGS Black Label" },
  { key: "BGS 10", label: "BGS 10" },
  { key: "BGS 9.5", label: "BGS 9.5" },
  { key: "BGS 9", label: "BGS 9" },
  { key: "CGC Pristine", label: "CGC Pristine" },
  { key: "CGC 10", label: "CGC 10" },
  { key: "CGC 9", label: "CGC 9" },
  { key: "CGC 8", label: "CGC 8" },
];

// ---- reference descriptions for the Condition Checker's example guide ----
const CONDITION_EXAMPLES = [
  { key: "NM", label: "Near Mint", color: "var(--green)", desc: "Sharp corners, clean edges, no visible scratches or whitening. Centering slightly off is still NM." },
  { key: "LP", label: "Lightly Played", color: "var(--cyan)", desc: "Minor edge wear or one soft corner. Surface may have very light scuffing under light." },
  { key: "MP", label: "Moderately Played", color: "var(--amber)", desc: "Visible corner rounding, some edge whitening, light scratches or a faint crease." },
  { key: "HP", label: "Heavily Played", color: "var(--red)", desc: "Noticeable creasing, heavy whitening, rounded corners, and/or surface scratching." },
];

// ---- Tools menu: categorized layout + per-tool metadata ----
const TOOL_CATEGORIES = [
  { key: "pricing", label: "Pricing & Selling" },
  { key: "grading", label: "Grading" },
  { key: "business", label: "Business" },
  { key: "data", label: "Data & Intake" },
];
const TOOL_META = {
  calculator: { short: "Calculator", label: "Quick Calculator", desc: "Fees, margins & split math on the fly", icon: CalcIcon, color: "var(--cyan)" },
  trade: { short: "Trade Analyzer", label: "Trade Analyzer", desc: "Compare both sides of a trade before you commit", icon: ArrowLeftRight, color: "var(--purple)" },
  crosslist: { short: "Cross-List", label: "Cross-List Manager", desc: "Push a card to eBay, TCGplayer, Whatnot & Shopify at once", icon: Repeat, color: "var(--cyan)" },
  repricing: { short: "Repricing", label: "Auto Repricing", desc: "Auto-adjust portfolio prices to undercut or match market", icon: RefreshCw, color: "var(--amber)" },
  psa: { short: "PSA Lookup", label: "PSA Cert Lookup", desc: "Verify a slab's cert number & pull its details", icon: ShieldCheck, color: "var(--green)" },
  grading: { short: "Grading Subs", label: "Grading Submission Tracker", desc: "Track subs out to PSA, CGC & BGS by status", icon: Award, color: "var(--amber)" },
  gradepredict: { short: "AI Grade Predict", label: "AI Grade Prediction", desc: "Snap a raw card & see its predicted grade + grading ROI", icon: Sparkles, color: "var(--purple)" },
  condition: { short: "Condition", label: "Condition Checker", desc: "Snap a photo for an AI condition estimate, plus example guides", icon: ScanSearch, color: "var(--green)" },
  taxexport: { short: "Tax Export", label: "Tax Export", desc: "Cash vs digital income, ready for your accountant", icon: Receipt, color: "var(--purple)" },
  insurance: { short: "Insurance", label: "Insurance / Appraisal Report", desc: "Printable itemized valuation of your whole collection", icon: FileCheck2, color: "var(--cyan)" },
  bulkscan: { short: "Bulk Intake", label: "Bulk Photo Intake", desc: "Snap a stack of cards, auto-match & add to a portfolio", icon: Camera, color: "var(--cyan)" },
  backup: { short: "Backup", label: "Full Backup & Restore", desc: "Export or import every portfolio, sale & setting as JSON", icon: CloudUpload, color: "var(--amber)" },
};
// ---- subscription gating ----
const PRO_TOOLS = ["crosslist", "repricing", "gradepredict", "condition", "insurance", "taxexport", "bulkscan"];
const PRO_STORE = ["pos", "kiosk"];
const FREE_LIMITS = { cardPortfolios: 2, sealedPortfolios: 1, watchlist: 5 };
const PRO_BENEFITS = [
  { icon: "CreditCard", text: "POS Register — ring up sales with Zelle, Venmo & CashApp at shows" },
  { icon: "ImageIcon", text: "Kiosk Mode — a customer-facing showcase of your inventory" },
  { icon: "Sparkles", text: "AI tools — grade prediction, condition checks & bulk photo intake" },
  { icon: "Repeat", text: "Cross-list to eBay, TCGplayer, Whatnot & Shopify in one tap" },
  { icon: "Receipt", text: "Tax export & printable insurance appraisals" },
  { icon: "Layers", text: "Unlimited portfolios & unlimited watchlist alerts" },
];

const STORE_META = {
  kiosk: { short: "Kiosk Mode", label: "Kiosk / Showcase Mode", desc: "Customer-facing screen so buyers can browse your booth inventory", icon: ImageIcon, color: "var(--green)" },
  pos: { short: "Register", label: "POS / Register Mode", desc: "Ring up a sale and charge via Zelle, Venmo, CashApp & more", icon: CreditCard, color: "var(--cyan)" },
  sales: { short: "Sales Log", label: "Sales Log", desc: "Record what sold, where, and for how much", icon: TrendingUp, color: "var(--green)" },
  topsellers: { short: "Top Sellers", label: "Top Sellers & Global Trending", desc: "Your best movers next to what's hot everywhere", icon: Award, color: "var(--amber)" },
  wantlist: { short: "Want List", label: "Customer Want List", desc: "Track what customers are hunting so you can source it", icon: Heart, color: "var(--red)" },
  expenses: { short: "Expenses", label: "Expenses", desc: "Supplies, show fees, shipping — everything going out", icon: Wallet, color: "var(--purple)" },
  fees: { short: "Fee Calc", label: "Fee Calculator", desc: "What each platform actually takes from a sale", icon: Receipt, color: "var(--cyan)" },
  connect: { short: "Storefront", label: "Connect Storefront", desc: "Link your Shopify / Whatnot / eBay accounts", icon: ShoppingBag, color: "var(--amber)" },
};

const CATEGORIES = [
  { key: "pokemon", label: "Pokémon" },
  { key: "onepiece", label: "One Piece" },
  { key: "football", label: "Football" },
  { key: "basketball", label: "Basketball" },
  { key: "baseball", label: "Baseball" },
];
const CATEGORY_LABEL = Object.fromEntries(CATEGORIES.map(c => [c.key, c.label]));

function mockLookup(name, set, condition) {
  const seed = hashStr(`${name}|${set}|${condition}`);
  const base = 4 + (seed % 4200) / 10;
  const mult = CONDITION_MULT[condition] ?? 1;
  const drift = ((seed >> 3) % 21) - 10;
  const price = Math.max(0.5, base * mult * (1 + drift / 400));
  return { price: Math.round(price * 100) / 100, trendPct: Math.round(drift * 10) / 10, comps: 6 + (seed % 34) };
}

function makeRow(name = "", set = "", condition = "Raw NM", qty = 1, nameMode = "single", category = "pokemon", costBasis = null) {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name, set, condition, qty, nameMode, category, costBasis,
    status: "queued", price: null, trendPct: null, comps: null, selected: true,
  };
}

function splitCardName(name, mode) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return { big: "", sub: "" };
  const cut = mode === "double" ? 2 : 1;
  return { big: words.slice(0, cut).join(" "), sub: words.slice(cut).join(" ") };
}

const ROUND_MODES = [
  { value: "none", label: "No rounding" },
  { value: "up", label: "Round up to nearest" },
  { value: "down", label: "Round down to nearest" },
  { value: "nearest", label: "Round to nearest" },
];
const ROUND_INCREMENTS = [0.05, 0.25, 0.50, 1, 5];

// ---- real card catalog for Search ----
// Pokémon is the one TCG with a genuinely open, free public database
// (pokemontcg.io) with stable, hotlinkable card images — so these are real
// cards, real sets, real numbers, real images. There's no equivalent free,
// image-inclusive open database for sports cards or One Piece yet; those
// stay manual-entry until a paid data partner (Card Ladder, TCGplayer
// partner API, etc.) is wired in.
// ═══════════════════════════════════════════════════════════════
// HOLOHQ DATA SCHEMA  (single source of truth for all card data)
// ───────────────────────────────────────────────────────────────
// Card catalog entry shape:
//   id        : "{setId}-{number}"           — unique key
//   name      : string                        — Pokémon/character name only, no suffix
//   variant   : string | null                 — e.g. "VMAX", "V", "ex", "GX", "Star"
//   finish    : string | null                 — "Alt Art", "Special Illustration Rare",
//                                               "Rainbow Rare", "Shiny", "Gold"
//   set       : string                        — official English set name
//   setId     : string                        — pokemontcg.io set ID
//   number    : string                        — card number in set
//   year      : string                        — release year
//   category  : "pokemon"|"onepiece"|
//               "football"|"basketball"|
//               "baseball"
//   rarity    : string | null                 — "Common","Uncommon","Rare","Rare Holo",
//                                               "Ultra Rare","Secret Rare","Special Illustration Rare"
//   image     : string | null                 — pokemontcg.io CDN URL (no API call needed)
//
// Display name is computed as: `${name}${variant ? " "+variant : ""}${finish ? " ("+finish+")" : ""}`
// e.g. name="Charizard", variant="VMAX", finish="Rainbow Rare" → "Charizard VMAX (Rainbow Rare)"
// ───────────────────────────────────────────────────────────────
// Sealed product entry shape:
//   productName : string                      — full product name
//   category    : same as above
//   type        : "booster-box"|"etb"|"blaster"|"build-fight"|"tin"|"case"
//   source      : "tcgplayer"|"ebay"
//   price       : number                      — current simulated market price
//   changePct   : number                      — simulated 30-day % change
//   image       : string | null               — CDN or null
// ═══════════════════════════════════════════════════════════════

// Helper: build the display name from schema fields
function cardDisplayName(c) {
  return `${c.name}${c.variant ? ` ${c.variant}` : ""}${c.finish ? ` (${c.finish})` : ""}`;
}

// Pre-baked card catalog. Images use the stable pokemontcg.io CDN —
// no API call needed, URLs are permanent and hotlinkable.
const SEARCH_CARDS = [
  // ── Base Set ─────────────────────────────────────────────────────────
  { id:"base1-4",   name:"Charizard",         variant:null,   finish:null,                        set:"Base Set",                    setId:"base1",     number:"4",    year:"1999", category:"pokemon", rarity:"Rare Holo",                    image:"https://images.pokemontcg.io/base1/4.png" },
  { id:"base1-4-1", name:"Charizard",         variant:null,   finish:null,                        set:"Base Set 1st Edition",        setId:"base1",     number:"4",    year:"1999", category:"pokemon", rarity:"Rare Holo",                    image:"https://images.pokemontcg.io/base1/4.png" },
  { id:"base1-2",   name:"Blastoise",         variant:null,   finish:null,                        set:"Base Set",                    setId:"base1",     number:"2",    year:"1999", category:"pokemon", rarity:"Rare Holo",                    image:"https://images.pokemontcg.io/base1/2.png" },
  { id:"base1-15",  name:"Venusaur",          variant:null,   finish:null,                        set:"Base Set",                    setId:"base1",     number:"15",   year:"1999", category:"pokemon", rarity:"Rare Holo",                    image:"https://images.pokemontcg.io/base1/15.png" },
  { id:"base1-1",   name:"Alakazam",          variant:null,   finish:null,                        set:"Base Set",                    setId:"base1",     number:"1",    year:"1999", category:"pokemon", rarity:"Rare Holo",                    image:"https://images.pokemontcg.io/base1/1.png" },
  { id:"base1-10",  name:"Mewtwo",            variant:null,   finish:null,                        set:"Base Set",                    setId:"base1",     number:"10",   year:"1999", category:"pokemon", rarity:"Rare Holo",                    image:"https://images.pokemontcg.io/base1/10.png" },
  { id:"base1-14",  name:"Raichu",            variant:null,   finish:null,                        set:"Base Set",                    setId:"base1",     number:"14",   year:"1999", category:"pokemon", rarity:"Rare Holo",                    image:"https://images.pokemontcg.io/base1/14.png" },
  { id:"base1-5",   name:"Clefairy",          variant:null,   finish:null,                        set:"Base Set",                    setId:"base1",     number:"5",    year:"1999", category:"pokemon", rarity:"Rare Holo",                    image:"https://images.pokemontcg.io/base1/5.png" },
  { id:"base1-11",  name:"Nidoking",          variant:null,   finish:null,                        set:"Base Set",                    setId:"base1",     number:"11",   year:"1999", category:"pokemon", rarity:"Rare Holo",                    image:"https://images.pokemontcg.io/base1/11.png" },
  { id:"base1-58",  name:"Pikachu",           variant:null,   finish:null,                        set:"Base Set",                    setId:"base1",     number:"58",   year:"1999", category:"pokemon", rarity:"Common",                       image:"https://images.pokemontcg.io/base1/58.png" },
  // ── Neo Genesis / Revelation ─────────────────────────────────────────
  { id:"neo1-9",    name:"Lugia",             variant:null,   finish:null,                        set:"Neo Genesis",                 setId:"neo1",      number:"9",    year:"2000", category:"pokemon", rarity:"Rare Holo",                    image:"https://images.pokemontcg.io/neo1/9.png" },
  { id:"neo1-12",   name:"Pichu",             variant:null,   finish:null,                        set:"Neo Genesis",                 setId:"neo1",      number:"12",   year:"2000", category:"pokemon", rarity:"Rare Holo",                    image:"https://images.pokemontcg.io/neo1/12.png" },
  { id:"neo1-17",   name:"Typhlosion",        variant:null,   finish:null,                        set:"Neo Genesis",                 setId:"neo1",      number:"17",   year:"2000", category:"pokemon", rarity:"Rare Holo",                    image:"https://images.pokemontcg.io/neo1/17.png" },
  { id:"neo3-7",    name:"Ho-Oh",             variant:null,   finish:null,                        set:"Neo Revelation",              setId:"neo3",      number:"7",    year:"2001", category:"pokemon", rarity:"Rare Holo",                    image:"https://images.pokemontcg.io/neo3/7.png" },
  { id:"neo3-9",    name:"Raikou",            variant:null,   finish:null,                        set:"Neo Revelation",              setId:"neo3",      number:"9",    year:"2001", category:"pokemon", rarity:"Rare Holo",                    image:"https://images.pokemontcg.io/neo3/9.png" },
  // ── Vintage ──────────────────────────────────────────────────────────
  { id:"ecard3-146",name:"Charizard",         variant:null,   finish:null,                        set:"Skyridge",                    setId:"ecard3",    number:"146",  year:"2003", category:"pokemon", rarity:"Rare Holo",                    image:"https://images.pokemontcg.io/ecard3/146.png" },
  { id:"ex15-100",  name:"Charizard",         variant:"Star", finish:null,                        set:"EX Dragon Frontiers",         setId:"ex15",      number:"100",  year:"2006", category:"pokemon", rarity:"Secret Rare",                  image:"https://images.pokemontcg.io/ex15/100.png" },
  { id:"dp1-6",     name:"Lucario",           variant:null,   finish:null,                        set:"Diamond & Pearl",             setId:"dp1",       number:"6",    year:"2007", category:"pokemon", rarity:"Rare Holo",                    image:"https://images.pokemontcg.io/dp1/6.png" },
  { id:"hgss1-113", name:"Lugia",             variant:"Legend",finish:null,                       set:"HeartGold SoulSilver",        setId:"hgss1",     number:"113",  year:"2010", category:"pokemon", rarity:"Ultra Rare",                   image:"https://images.pokemontcg.io/hgss1/113.png" },
  { id:"hgss1-111", name:"Ho-Oh",             variant:"Legend",finish:null,                       set:"HeartGold SoulSilver",        setId:"hgss1",     number:"111",  year:"2010", category:"pokemon", rarity:"Ultra Rare",                   image:"https://images.pokemontcg.io/hgss1/111.png" },
  { id:"bw1-114",   name:"Zekrom",            variant:null,   finish:null,                        set:"Black & White",               setId:"bw1",       number:"114",  year:"2011", category:"pokemon", rarity:"Rare Holo",                    image:"https://images.pokemontcg.io/bw1/114.png" },
  { id:"bw1-113",   name:"Reshiram",          variant:null,   finish:null,                        set:"Black & White",               setId:"bw1",       number:"113",  year:"2011", category:"pokemon", rarity:"Rare Holo",                    image:"https://images.pokemontcg.io/bw1/113.png" },
  { id:"bw8-136",   name:"Charizard",         variant:null,   finish:null,                        set:"Plasma Storm",                setId:"bw8",       number:"136",  year:"2013", category:"pokemon", rarity:"Rare Holo",                    image:"https://images.pokemontcg.io/bw8/136.png" },
  { id:"xy12-11",   name:"Charizard",         variant:null,   finish:null,                        set:"XY Evolutions",               setId:"xy12",      number:"11",   year:"2016", category:"pokemon", rarity:"Rare Holo",                    image:"https://images.pokemontcg.io/xy12/11.png" },
  { id:"xy12-51",   name:"Mewtwo",            variant:null,   finish:null,                        set:"XY Evolutions",               setId:"xy12",      number:"51",   year:"2016", category:"pokemon", rarity:"Rare Holo",                    image:"https://images.pokemontcg.io/xy12/51.png" },
  // ── Hidden Fates ─────────────────────────────────────────────────────
  { id:"sma-SV49",  name:"Charizard",         variant:"GX",   finish:"Shiny",                     set:"Hidden Fates: Shiny Vault",   setId:"sma",       number:"SV49", year:"2019", category:"pokemon", rarity:"Shiny Secret Rare",            image:"https://images.pokemontcg.io/sma/SV49.png" },
  { id:"sma-SV26",  name:"Gyarados",          variant:"GX",   finish:"Shiny",                     set:"Hidden Fates: Shiny Vault",   setId:"sma",       number:"SV26", year:"2019", category:"pokemon", rarity:"Shiny Secret Rare",            image:"https://images.pokemontcg.io/sma/SV26.png" },
  { id:"sma-SV58",  name:"Mewtwo",            variant:"GX",   finish:"Shiny",                     set:"Hidden Fates: Shiny Vault",   setId:"sma",       number:"SV58", year:"2019", category:"pokemon", rarity:"Shiny Secret Rare",            image:"https://images.pokemontcg.io/sma/SV58.png" },
  // ── Sword & Shield ───────────────────────────────────────────────────
  { id:"swsh4-188", name:"Pikachu",           variant:"VMAX", finish:"Rainbow Rare",              set:"Vivid Voltage",               setId:"swsh4",     number:"188",  year:"2020", category:"pokemon", rarity:"Secret Rare",                  image:"https://images.pokemontcg.io/swsh4/188.png" },
  { id:"swsh4-170", name:"Pikachu",           variant:"V",    finish:null,                        set:"Vivid Voltage",               setId:"swsh4",     number:"170",  year:"2020", category:"pokemon", rarity:"Ultra Rare",                   image:"https://images.pokemontcg.io/swsh4/170.png" },
  { id:"cpa-74",    name:"Charizard",         variant:"VMAX", finish:"Rainbow Rare",              set:"Champion's Path",             setId:"cpa",       number:"74",   year:"2020", category:"pokemon", rarity:"Secret Rare",                  image:"https://images.pokemontcg.io/cpa/74.png" },
  { id:"cpa-79",    name:"Charizard",         variant:"V",    finish:"Alt Art",                   set:"Champion's Path",             setId:"cpa",       number:"79",   year:"2020", category:"pokemon", rarity:"Secret Rare",                  image:"https://images.pokemontcg.io/cpa/79.png" },
  { id:"swsh5-168", name:"Single Strike Urshifu",variant:"VMAX",finish:null,                     set:"Battle Styles",               setId:"swsh5",     number:"168",  year:"2021", category:"pokemon", rarity:"Secret Rare",                  image:"https://images.pokemontcg.io/swsh5/168.png" },
  { id:"swsh5-170", name:"Rapid Strike Urshifu",variant:"VMAX",finish:null,                      set:"Battle Styles",               setId:"swsh5",     number:"170",  year:"2021", category:"pokemon", rarity:"Secret Rare",                  image:"https://images.pokemontcg.io/swsh5/170.png" },
  { id:"swsh6-200", name:"Shadow Rider Calyrex",variant:"VMAX",finish:null,                      set:"Chilling Reign",              setId:"swsh6",     number:"200",  year:"2021", category:"pokemon", rarity:"Secret Rare",                  image:"https://images.pokemontcg.io/swsh6/200.png" },
  { id:"swsh6-202", name:"Ice Rider Calyrex",  variant:"VMAX", finish:null,                      set:"Chilling Reign",              setId:"swsh6",     number:"202",  year:"2021", category:"pokemon", rarity:"Secret Rare",                  image:"https://images.pokemontcg.io/swsh6/202.png" },
  // ── Evolving Skies ────────────────────────────────────────────────────
  { id:"swsh7-215", name:"Umbreon",           variant:"VMAX", finish:"Alt Art",                   set:"Evolving Skies",              setId:"swsh7",     number:"215",  year:"2021", category:"pokemon", rarity:"Secret Rare",                  image:"https://images.pokemontcg.io/swsh7/215.png" },
  { id:"swsh7-218", name:"Rayquaza",          variant:"VMAX", finish:"Alt Art",                   set:"Evolving Skies",              setId:"swsh7",     number:"218",  year:"2021", category:"pokemon", rarity:"Secret Rare",                  image:"https://images.pokemontcg.io/swsh7/218.png" },
  { id:"swsh7-203", name:"Sylveon",           variant:"VMAX", finish:"Alt Art",                   set:"Evolving Skies",              setId:"swsh7",     number:"203",  year:"2021", category:"pokemon", rarity:"Secret Rare",                  image:"https://images.pokemontcg.io/swsh7/203.png" },
  { id:"swsh7-209", name:"Glaceon",           variant:"VMAX", finish:"Alt Art",                   set:"Evolving Skies",              setId:"swsh7",     number:"209",  year:"2021", category:"pokemon", rarity:"Secret Rare",                  image:"https://images.pokemontcg.io/swsh7/209.png" },
  { id:"swsh7-205", name:"Leafeon",           variant:"VMAX", finish:"Alt Art",                   set:"Evolving Skies",              setId:"swsh7",     number:"205",  year:"2021", category:"pokemon", rarity:"Secret Rare",                  image:"https://images.pokemontcg.io/swsh7/205.png" },
  { id:"swsh7-208", name:"Espeon",            variant:"VMAX", finish:"Alt Art",                   set:"Evolving Skies",              setId:"swsh7",     number:"208",  year:"2021", category:"pokemon", rarity:"Secret Rare",                  image:"https://images.pokemontcg.io/swsh7/208.png" },
  { id:"swsh7-213", name:"Flareon",           variant:"VMAX", finish:"Alt Art",                   set:"Evolving Skies",              setId:"swsh7",     number:"213",  year:"2021", category:"pokemon", rarity:"Secret Rare",                  image:"https://images.pokemontcg.io/swsh7/213.png" },
  { id:"swsh7-211", name:"Jolteon",           variant:"VMAX", finish:"Alt Art",                   set:"Evolving Skies",              setId:"swsh7",     number:"211",  year:"2021", category:"pokemon", rarity:"Secret Rare",                  image:"https://images.pokemontcg.io/swsh7/211.png" },
  { id:"swsh7-207", name:"Vaporeon",          variant:"VMAX", finish:"Alt Art",                   set:"Evolving Skies",              setId:"swsh7",     number:"207",  year:"2021", category:"pokemon", rarity:"Secret Rare",                  image:"https://images.pokemontcg.io/swsh7/207.png" },
  { id:"swsh8-271", name:"Gengar",            variant:"VMAX", finish:"Alt Art",                   set:"Fusion Strike",               setId:"swsh8",     number:"271",  year:"2021", category:"pokemon", rarity:"Secret Rare",                  image:"https://images.pokemontcg.io/swsh8/271.png" },
  { id:"swsh8-269", name:"Mew",               variant:"VMAX", finish:null,                        set:"Fusion Strike",               setId:"swsh8",     number:"269",  year:"2021", category:"pokemon", rarity:"Secret Rare",                  image:"https://images.pokemontcg.io/swsh8/269.png" },
  { id:"swsh9-174", name:"Charizard",         variant:"VSTAR",finish:"Rainbow Rare",              set:"Brilliant Stars",             setId:"swsh9",     number:"174",  year:"2022", category:"pokemon", rarity:"Secret Rare",                  image:"https://images.pokemontcg.io/swsh9/174.png" },
  { id:"swsh9-176", name:"Arceus",            variant:"VSTAR",finish:null,                        set:"Brilliant Stars",             setId:"swsh9",     number:"176",  year:"2022", category:"pokemon", rarity:"Ultra Rare",                   image:"https://images.pokemontcg.io/swsh9/176.png" },
  { id:"swsh9-186", name:"Lumineon",          variant:"V",    finish:"Alt Art",                   set:"Brilliant Stars",             setId:"swsh9",     number:"186",  year:"2022", category:"pokemon", rarity:"Secret Rare",                  image:"https://images.pokemontcg.io/swsh9/186.png" },
  { id:"swsh10-209",name:"Origin Forme Palkia",variant:"VSTAR",finish:"Alt Art",                  set:"Astral Radiance",             setId:"swsh10",    number:"209",  year:"2022", category:"pokemon", rarity:"Secret Rare",                  image:"https://images.pokemontcg.io/swsh10/209.png" },
  { id:"swsh10-214",name:"Hisuian Zoroark",   variant:"VSTAR",finish:"Alt Art",                   set:"Astral Radiance",             setId:"swsh10",    number:"214",  year:"2022", category:"pokemon", rarity:"Secret Rare",                  image:"https://images.pokemontcg.io/swsh10/214.png" },
  { id:"swsh11-214",name:"Giratina",          variant:"VSTAR",finish:"Alt Art",                   set:"Lost Origin",                 setId:"swsh11",    number:"214",  year:"2022", category:"pokemon", rarity:"Secret Rare",                  image:"https://images.pokemontcg.io/swsh11/214.png" },
  { id:"swsh11-213",name:"Aerodactyl",        variant:"VSTAR",finish:null,                        set:"Lost Origin",                 setId:"swsh11",    number:"213",  year:"2022", category:"pokemon", rarity:"Ultra Rare",                   image:"https://images.pokemontcg.io/swsh11/213.png" },
  { id:"swsh12-211",name:"Lugia",             variant:"VSTAR",finish:"Special Art",               set:"Silver Tempest",              setId:"swsh12",    number:"211",  year:"2022", category:"pokemon", rarity:"Secret Rare",                  image:"https://images.pokemontcg.io/swsh12/211.png" },
  { id:"swsh12-195",name:"Regidrago",         variant:"VSTAR",finish:null,                        set:"Silver Tempest",              setId:"swsh12",    number:"195",  year:"2022", category:"pokemon", rarity:"Ultra Rare",                   image:"https://images.pokemontcg.io/swsh12/195.png" },
  { id:"swsh12pt5-160",name:"Pikachu",        variant:"VMAX", finish:null,                        set:"Crown Zenith",                setId:"swsh12pt5", number:"160",  year:"2023", category:"pokemon", rarity:"Ultra Rare",                   image:"https://images.pokemontcg.io/swsh12pt5/160.png" },
  // ── Scarlet & Violet ────────────────────────────────────────────────
  { id:"sv1-227",   name:"Miraidon",          variant:"ex",   finish:null,                        set:"Scarlet & Violet",            setId:"sv1",       number:"227",  year:"2023", category:"pokemon", rarity:"Special Illustration Rare",    image:"https://images.pokemontcg.io/sv1/227.png" },
  { id:"sv1-247",   name:"Koraidon",          variant:"ex",   finish:null,                        set:"Scarlet & Violet",            setId:"sv1",       number:"247",  year:"2023", category:"pokemon", rarity:"Special Illustration Rare",    image:"https://images.pokemontcg.io/sv1/247.png" },
  { id:"sv3-228",   name:"Charizard",         variant:"ex",   finish:"Special Illustration Rare", set:"Obsidian Flames",             setId:"sv3",       number:"228",  year:"2023", category:"pokemon", rarity:"Special Illustration Rare",    image:"https://images.pokemontcg.io/sv3/228.png" },
  { id:"sv3-225",   name:"Tyranitar",         variant:"ex",   finish:"Special Illustration Rare", set:"Obsidian Flames",             setId:"sv3",       number:"225",  year:"2023", category:"pokemon", rarity:"Special Illustration Rare",    image:"https://images.pokemontcg.io/sv3/225.png" },
  // ── 151 ──────────────────────────────────────────────────────────────
  { id:"sv3pt5-199",name:"Charizard",         variant:"ex",   finish:"Special Illustration Rare", set:"Scarlet & Violet 151",        setId:"sv3pt5",    number:"199",  year:"2023", category:"pokemon", rarity:"Special Illustration Rare",    image:"https://images.pokemontcg.io/sv3pt5/199.png" },
  { id:"sv3pt5-205",name:"Mew",               variant:"ex",   finish:"Special Illustration Rare", set:"Scarlet & Violet 151",        setId:"sv3pt5",    number:"205",  year:"2023", category:"pokemon", rarity:"Special Illustration Rare",    image:"https://images.pokemontcg.io/sv3pt5/205.png" },
  { id:"sv3pt5-203",name:"Gengar",            variant:"ex",   finish:"Special Illustration Rare", set:"Scarlet & Violet 151",        setId:"sv3pt5",    number:"203",  year:"2023", category:"pokemon", rarity:"Special Illustration Rare",    image:"https://images.pokemontcg.io/sv3pt5/203.png" },
  { id:"sv3pt5-200",name:"Alakazam",          variant:"ex",   finish:"Special Illustration Rare", set:"Scarlet & Violet 151",        setId:"sv3pt5",    number:"200",  year:"2023", category:"pokemon", rarity:"Special Illustration Rare",    image:"https://images.pokemontcg.io/sv3pt5/200.png" },
  { id:"sv3pt5-197",name:"Blastoise",         variant:"ex",   finish:"Special Illustration Rare", set:"Scarlet & Violet 151",        setId:"sv3pt5",    number:"197",  year:"2023", category:"pokemon", rarity:"Special Illustration Rare",    image:"https://images.pokemontcg.io/sv3pt5/197.png" },
  { id:"sv3pt5-198",name:"Venusaur",          variant:"ex",   finish:"Special Illustration Rare", set:"Scarlet & Violet 151",        setId:"sv3pt5",    number:"198",  year:"2023", category:"pokemon", rarity:"Special Illustration Rare",    image:"https://images.pokemontcg.io/sv3pt5/198.png" },
  // ── Paradox Rift → Stellar Crown ─────────────────────────────────────
  { id:"sv4-245",   name:"Iron Valiant",      variant:"ex",   finish:"Special Illustration Rare", set:"Paradox Rift",                setId:"sv4",       number:"245",  year:"2023", category:"pokemon", rarity:"Special Illustration Rare",    image:"https://images.pokemontcg.io/sv4/245.png" },
  { id:"sv4-235",   name:"Roaring Moon",      variant:"ex",   finish:"Special Illustration Rare", set:"Paradox Rift",                setId:"sv4",       number:"235",  year:"2023", category:"pokemon", rarity:"Special Illustration Rare",    image:"https://images.pokemontcg.io/sv4/235.png" },
  { id:"sv5-206",   name:"Walking Wake",      variant:"ex",   finish:"Special Illustration Rare", set:"Temporal Forces",             setId:"sv5",       number:"206",  year:"2024", category:"pokemon", rarity:"Special Illustration Rare",    image:"https://images.pokemontcg.io/sv5/206.png" },
  { id:"sv5-207",   name:"Iron Leaves",       variant:"ex",   finish:"Special Illustration Rare", set:"Temporal Forces",             setId:"sv5",       number:"207",  year:"2024", category:"pokemon", rarity:"Special Illustration Rare",    image:"https://images.pokemontcg.io/sv5/207.png" },
  { id:"sv6-206",   name:"Ogerpon",           variant:"ex",   finish:"Special Illustration Rare", set:"Twilight Masquerade",         setId:"sv6",       number:"206",  year:"2024", category:"pokemon", rarity:"Special Illustration Rare",    image:"https://images.pokemontcg.io/sv6/206.png" },
  { id:"sv6-207",   name:"Teal Mask Ogerpon", variant:"ex",   finish:"Special Illustration Rare", set:"Twilight Masquerade",         setId:"sv6",       number:"207",  year:"2024", category:"pokemon", rarity:"Special Illustration Rare",    image:"https://images.pokemontcg.io/sv6/207.png" },
  { id:"sv7-168",   name:"Terapagos",         variant:"ex",   finish:"Special Illustration Rare", set:"Stellar Crown",               setId:"sv7",       number:"168",  year:"2024", category:"pokemon", rarity:"Special Illustration Rare",    image:"https://images.pokemontcg.io/sv7/168.png" },
  { id:"sv7-170",   name:"Dragapult",         variant:"ex",   finish:"Special Illustration Rare", set:"Stellar Crown",               setId:"sv7",       number:"170",  year:"2024", category:"pokemon", rarity:"Special Illustration Rare",    image:"https://images.pokemontcg.io/sv7/170.png" },
];
// Enrich each entry with a computed display name so the rest of the app can
// just use card.name and not have to re-derive it everywhere
SEARCH_CARDS.forEach(c => { c.displayName = cardDisplayName(c); });

function cardImageUrl(card) { return card.image || `https://images.pokemontcg.io/${card.setId}/${card.number}.png`; }

// Matches a free-typed portfolio row name (e.g. "Charizard 4/102 Base Set")
// to a catalog entry so we can show its real image. Loose on purpose.
// Maps sealed product names to logo/box art.
// For Pokémon sealed we use the set logo from pokemontcg.io — recognisable & royalty-free.
// Sports/One Piece don't have a free public image API, so they get a null (placeholder shown).
const SEALED_IMAGE_MAP = {
  "Evolving Skies Booster Box": "https://images.pokemontcg.io/swsh7/logo.png",
  "Champion's Path Elite Trainer Box": "https://images.pokemontcg.io/cpa/logo.png",
  "151 Booster Box": "https://images.pokemontcg.io/sv3pt5/logo.png",
  "Vivid Voltage Booster Box": "https://images.pokemontcg.io/swsh4/logo.png",
  "Brilliant Stars Booster Box": "https://images.pokemontcg.io/swsh9/logo.png",
  "Lost Origin Booster Box": "https://images.pokemontcg.io/swsh11/logo.png",
  "Silver Tempest Booster Box": "https://images.pokemontcg.io/swsh12/logo.png",
};
function findSealedImage(productName) {
  const direct = SEALED_IMAGE_MAP[productName];
  if (direct) return direct;
  // Try to match by set name fragments
  const lower = (productName || "").toLowerCase();
  const entry = Object.entries(SEALED_IMAGE_MAP).find(([k]) => lower.includes(k.split(" ")[0].toLowerCase()) && lower.includes("pokemon"));
  return entry ? entry[1] : null;
}
// Strip punctuation/special chars for fuzzy matching
function cleanStr(s) { return (s || "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim(); }
function findCatalogImage(rowName, rowSet) {
  const n = cleanStr(rowName);
  const s = cleanStr(rowSet);
  // 1. Match on full displayName + set
  let hit = SEARCH_CARDS.find(c => cleanStr(c.displayName) === n && (cleanStr(c.set) === s || !s));
  // 2. Match on displayName alone
  if (!hit) hit = SEARCH_CARDS.find(c => n.includes(cleanStr(c.displayName)));
  // 3. Match on name + variant
  if (!hit) hit = SEARCH_CARDS.find(c => {
    const nameVar = cleanStr(`${c.name}${c.variant ? " " + c.variant : ""}`);
    return n.includes(nameVar) && nameVar.length > 5;
  });
  // 4. Match on name alone + set
  if (!hit) hit = SEARCH_CARDS.find(c => n.includes(cleanStr(c.name)) && (cleanStr(c.set) === s || n.includes(cleanStr(c.set))));
  // 5. Fallback: name alone
  if (!hit) hit = SEARCH_CARDS.find(c => n.includes(cleanStr(c.name)));
  return hit ? (hit.image || cardImageUrl(hit)) : null;
}

// ---- market-wide movers (Home / Explore) ----
// Independent of any user's portfolio — stands in for aggregated eBay +
// TCGplayer + Alt comps. Real version needs those platforms' sold-listing
// APIs (TCGplayer's requires partner approval; eBay has a Sold Items API;
// Alt doesn't publish a public API as of this writing).
const MARKET_MOVERS = [
  { name: "Charizard VMAX (Rainbow)", set: "Champion's Path", category: "pokemon", price: 210.5, changePct: 14.2, comps: 88 },
  { name: "Umbreon VMAX Alt Art", set: "Evolving Skies", category: "pokemon", price: 320.0, changePct: 9.6, comps: 142 },
  { name: "Sylveon VMAX Alt Art", set: "Evolving Skies", category: "pokemon", price: 145.25, changePct: -6.4, comps: 71 },
  { name: "Rayquaza VMAX Alt Art", set: "Evolving Skies", category: "pokemon", price: 289.0, changePct: 5.1, comps: 96 },
  { name: "Lugia 1st Edition", set: "Neo Genesis", category: "pokemon", price: 4100.0, changePct: 11.3, comps: 12 },
  { name: "Monkey D. Luffy Parallel", set: "OP-01", category: "onepiece", price: 410.0, changePct: 22.8, comps: 54 },
  { name: "Shanks Manga Rare", set: "OP-01", category: "onepiece", price: 610.0, changePct: -3.2, comps: 19 },
  { name: "Roronoa Zoro Alt Art", set: "OP-06", category: "onepiece", price: 88.0, changePct: 17.5, comps: 63 },
  { name: "Patrick Mahomes Rookie PSA 10", set: "Prizm", category: "football", price: 12500.0, changePct: -4.8, comps: 8 },
  { name: "Justin Jefferson Optic Rookie", set: "Optic", category: "football", price: 62.0, changePct: 6.9, comps: 41 },
  { name: "CJ Stroud Rookie Auto", set: "Prizm", category: "football", price: 340.0, changePct: 13.7, comps: 27 },
  { name: "LeBron James Prizm Silver", set: "Prizm", category: "basketball", price: 1150.0, changePct: 8.4, comps: 22 },
  { name: "Victor Wembanyama Rookie", set: "Prizm", category: "basketball", price: 480.0, changePct: 19.1, comps: 65 },
  { name: "Caitlin Clark Rookie Auto", set: "Prizm", category: "basketball", price: 890.0, changePct: 24.6, comps: 58 },
  { name: "Mike Trout Chrome Refractor", set: "Bowman Chrome", category: "baseball", price: 275.0, changePct: -2.1, comps: 33 },
  { name: "Shohei Ohtani Rookie Auto", set: "Bowman Chrome", category: "baseball", price: 2100.0, changePct: 10.5, comps: 15 },
  { name: "Paul Skenes Rookie", set: "Bowman Chrome", category: "baseball", price: 165.0, changePct: 15.8, comps: 44 },
];

// ---- release calendar (Explore) ----
// Real confirmed 2026 Pokémon TCG dates. Sports/One Piece calendars aren't
// as centrally published — Pokémon-only for now, noted in the UI.
const RELEASE_CALENDAR = [
  { name: "Mega Evolution: Pitch Black", category: "pokemon", date: "2026-07-17", note: "5th Mega Evolution set — Mega Darkrai ex" },
  { name: "30th Celebration", category: "pokemon", date: "2026-09-16", note: "First-ever simultaneous worldwide launch, all-foil packs" },
  { name: "Mega Evolution: Delta Reign", category: "pokemon", date: "2026-11-06", note: "Final Mega Evolution set — Mega Rayquaza ex" },
];

// ---- master sets (Explore) — real set sizes, with pokemontcg.io logo IDs where available ----
const MASTER_SETS = [
  { name: "Base Set", setId: "base1", category: "pokemon", total: 102 },
  { name: "Neo Genesis", setId: "neo1", category: "pokemon", total: 111 },
  { name: "Evolving Skies", setId: "swsh7", category: "pokemon", total: 203 },
  { name: "Champion's Path", setId: "cpa", category: "pokemon", total: 80 },
  { name: "OP-01 Romance Dawn", setId: null, category: "onepiece", total: 121 },
  { name: "OP-07 500 Years in the Future", setId: null, category: "onepiece", total: 128 },
];
function setLogoUrl(set) {
  return set.setId ? `https://images.pokemontcg.io/${set.setId}/logo.png` : null;
}

// ---- simulated PSA/CGC/BGS population count for a specific card + grade ----
// Deterministic per name/set/grade so it's stable across visits, like every
// other simulated number in this file — a production build swaps this for
// PSA's Population Report API (and CGC/BGS equivalents where published).
function getGradePopulation(name, set, conditionKey) {
  const seed = hashStr(`pop|${name}|${set || ""}|${conditionKey}`);
  return 20 + (seed % 3400);
}

// ---- marketplace fee estimates (My Store) ----
// Rates change and vary by category/seller level — treat as estimates.
const PLATFORM_FEES = {
  inperson: { label: "In-person", pct: 0, flat: 0 },
  ebay: { label: "eBay", pct: 13.25, flat: 0.4 },
  tcgplayer: { label: "TCGplayer", pct: 13.25, flat: 0.3 },
  whatnot: { label: "Whatnot", pct: 10.9, flat: 0.3 },
};

// ---- grading companies + turnaround tiers (Tools > Grading Tracker) ----
const GRADING_COMPANIES = {
  psa: { short: "PSA Lookup", label: "PSA", color: "#F5A524", tiers: ["Value", "Regular", "Express", "Super Express", "Walk-Through"] },
  cgc: { label: "CGC", color: "#2DD4E8", tiers: ["Standard", "Express", "Premium"] },
  bgs: { label: "BGS", color: "#8B5CF6", tiers: ["Standard", "Express", "Premium"] },
};
const GRADING_STATUSES = ["Submitted", "Received", "Grading", "Quality Control", "Shipped Back", "Complete"];

// ---- payout methods a seller can link for POS / Register mode ----
const PAYOUT_METHODS = [
  { key: "zelle", label: "Zelle" },
  { key: "venmo", label: "Venmo" },
  { key: "cashapp", label: "Cash App" },
  { key: "paypal", label: "PayPal" },
  { key: "shopify", label: "Shopify Tap to Pay" },
  { key: "cash", label: "Cash" },
];

// ---- payment method → tax bucket, for Tax Export ----
// Cards platforms (eBay/TCGplayer/Whatnot) always count as digital income.
// In-person sales can go either way depending on how the buyer actually paid.
function isDigitalPayment(method) {
  return method !== "cash";
}

// ---- global marketplace trending, tagged by source (Explore) ----
// Same shape as MARKET_MOVERS but explicitly sourced, standing in for a real
// pull from TCGplayer's pulse/velocity data and eBay's Sold Items API.
const GLOBAL_TRENDING = [
  { name: "Charizard VMAX (Rainbow)", set: "Champion's Path", category: "pokemon", source: "tcgplayer", price: 212.0, changePct: 15.1 },
  { name: "Umbreon VMAX Alt Art", set: "Evolving Skies", category: "pokemon", source: "ebay", price: 318.5, changePct: 8.9 },
  { name: "Monkey D. Luffy Parallel", set: "OP-01", category: "onepiece", source: "tcgplayer", price: 405.0, changePct: 21.4 },
  { name: "Victor Wembanyama Rookie", set: "Prizm", category: "basketball", source: "ebay", price: 495.0, changePct: 20.3 },
  { name: "Caitlin Clark Rookie Auto", set: "Prizm", category: "basketball", source: "ebay", price: 910.0, changePct: 25.8 },
  { name: "Paul Skenes Rookie", set: "Bowman Chrome", category: "baseball", source: "tcgplayer", price: 172.0, changePct: 16.9 },
];

// ---- sealed product trending / top movers (Portfolio > Sealed > Trending) ----
// Same idea as GLOBAL_TRENDING but for unopened product — booster boxes, ETBs,
// blasters — standing in for a real pull from TCGplayer/eBay sealed comps.
const SEALED_TRENDING = [
  { productName: "Evolving Skies Booster Box", category: "pokemon", source: "tcgplayer", price: 289.0, changePct: 12.4 },
  { productName: "Champion's Path Elite Trainer Box", category: "pokemon", source: "ebay", price: 165.0, changePct: -5.6 },
  { productName: "151 Booster Box", category: "pokemon", source: "tcgplayer", price: 210.0, changePct: 9.8 },
  { productName: "OP-07 Booster Box", category: "onepiece", source: "tcgplayer", price: 122.0, changePct: 18.3 },
  { productName: "OP-01 Booster Box", category: "onepiece", source: "ebay", price: 480.0, changePct: 6.2 },
  { productName: "2024 Prizm Football Hobby Box", category: "football", source: "ebay", price: 425.0, changePct: -3.9 },
  { productName: "2024 Prizm Basketball Hobby Box", category: "basketball", source: "tcgplayer", price: 390.0, changePct: 14.7 },
  { productName: "Bowman Chrome Baseball Hobby Box", category: "baseball", source: "ebay", price: 310.0, changePct: 7.1 },
];

// ---- unified search catalog — merges every card/product source in the app ----
// (real Pokémon catalog + market movers + global trending) into one list so
// Search finds anything HoloHQ knows about, not just the narrow demo catalog.
const ALL_SEARCH_CARDS = (() => {
  const map = new Map();
  SEARCH_CARDS.forEach(c => {
    const key = `${c.name}|${c.set}`;
    const { price } = mockLookup(c.name, c.set, "Raw NM");
    map.set(key, { ...c, price, popularity: 60 + hashStr(key) % 40, image: cardImageUrl(c), displayName: c.displayName || c.name });
  });
  MARKET_MOVERS.forEach(c => {
    const key = `${c.name}|${c.set}`;
    if (!map.has(key)) map.set(key, { name: c.name, set: c.set, category: c.category, price: c.price, popularity: c.comps });
  });
  GLOBAL_TRENDING.forEach(c => {
    const key = `${c.name}|${c.set}`;
    if (!map.has(key)) map.set(key, { name: c.name, set: c.set, category: c.category, price: c.price, popularity: 50 + Math.round(c.changePct) });
  });
  return Array.from(map.values());
})();
const ALL_SEARCH_SEALED = SEALED_TRENDING.map(t => ({ ...t, popularity: 50 + Math.round(t.changePct), image: SEALED_IMAGE_MAP[t.productName] || null }));

function CardThumb({ card, size = 40 }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div style={{ width: size, height: size * 1.4, borderRadius: 4, background: "var(--panel-2)", border: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Sparkles size={14} color="var(--muted)" />
      </div>
    );
  }
  return (
    <img src={cardImageUrl(card)} alt={card.name} onError={() => setFailed(true)}
      style={{ width: size, height: size * 1.4, objectFit: "cover", borderRadius: 4, flexShrink: 0, background: "var(--panel-2)" }} />
  );
}

// CardImage — shows a real card/sealed image or a branded placeholder.
// Accepts a direct imageUrl (from live API), falls back to local catalog lookup.
function CardImage({ name, set, sealedName, imageUrl, height = 140, style: extraStyle = {} }) {
  const [failed, setFailed] = useState(false);
  const url = imageUrl || (sealedName ? (SEALED_IMAGE_MAP[sealedName] || null) : findCatalogImage(name, set));
  if (!url || failed) {
    return (
      <div style={{ height, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, background: "linear-gradient(160deg, var(--panel-2), var(--panel))", borderRadius: 12, ...extraStyle }}>
        {sealedName ? <Layers size={28} color="var(--muted)" /> : <Sparkles size={28} color="var(--muted)" />}
        <span style={{ fontSize: 10, color: "var(--muted)", textAlign: "center", maxWidth: 120, lineHeight: 1.3 }}>{sealedName || name || "Card image"}</span>
      </div>
    );
  }
  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height, ...extraStyle }}>
      <img src={url} alt={name || sealedName} onError={() => setFailed(true)}
        style={{ maxHeight: height - 16, maxWidth: "90%", objectFit: "contain", filter: "drop-shadow(0 8px 20px rgba(0,0,0,0.55))", borderRadius: 6 }} />
    </div>
  );
}

// ---- mock PSA cert verification ----
// Stands in for PSA's real Cert Verification API. Real integration needs a
// backend proxy holding the OAuth token — PSA's own docs say never put that
// credential in client-side code, which is exactly what this file is.
const CERT_POOL = [
  { subject: "Charizard", brand: "1999 Pokemon Base Set", year: "1999", cardNumber: "4", category: "pokemon" },
  { subject: "Umbreon VMAX", brand: "Evolving Skies", year: "2021", cardNumber: "215", category: "pokemon" },
  { subject: "Michael Jordan", brand: "1986 Fleer", year: "1986", cardNumber: "57", category: "basketball" },
  { subject: "Mike Trout", brand: "2011 Bowman Chrome", year: "2011", cardNumber: "175", category: "baseball" },
  { subject: "Tom Brady", brand: "2000 Playoff Contenders", year: "2000", cardNumber: "144", category: "football" },
  { subject: "Monkey D. Luffy", brand: "One Piece OP-01", year: "2022", cardNumber: "3", category: "onepiece" },
];
const GRADE_LABEL = { 10: "Gem Mint", 9: "Mint", 8: "NM-MT", 7: "Near Mint", 6: "EX-MT", 5: "EX", 4: "VG-EX", 3: "VG", 2: "Good", 1: "Poor" };

function mockCertLookup(certNumber) {
  const clean = certNumber.trim();
  if (!/^\d{6,10}$/.test(clean)) return { valid: false };
  const seed = hashStr(clean);
  const card = CERT_POOL[seed % CERT_POOL.length];
  const grade = 5 + (seed % 6); // 5-10, graded cards skew high
  return {
    valid: true, certNumber: clean, ...card, grade,
    gradeLabel: GRADE_LABEL[grade], population: 40 + (seed % 2400), populationHigher: seed % 80,
  };
}

function computeLabelPrice(price, settings) {
  if (price == null) return null;
  let p = price * (1 + (settings.adjustPct || 0) / 100);
  const inc = settings.roundIncrement || 0.01;
  if (settings.roundMode === "up") p = Math.ceil(p / inc) * inc;
  else if (settings.roundMode === "down") p = Math.floor(p / inc) * inc;
  else if (settings.roundMode === "nearest") p = Math.round(p / inc) * inc;
  return Math.max(0, Math.round(p * 100) / 100);
}

function seedRow(name, set, condition, qty, category, nameMode = "single", costBasis = null) {
  const r = makeRow(name, set, condition, qty, nameMode, category, costBasis);
  const { price, trendPct, comps } = mockLookup(name, set, condition);
  return { ...r, status: "priced", price, trendPct, comps };
}

const SEED_PORTFOLIOS = [
  {
    id: "p1", name: "Show Inventory — July", accent: "var(--cyan)",
    rows: [
      seedRow("Charizard 4/102 Base Set", "Base Set", "PSA 9", 1, "pokemon", "single", 68),
      seedRow("Umbreon VMAX Alt Art", "Evolving Skies", "Raw NM", 2, "pokemon", "single", 32),
      seedRow("Blastoise 2/102 Base Set", "Base Set", "PSA 8", 1, "pokemon"),
      seedRow("Rayquaza VMAX Alt Art", "Evolving Skies", "PSA 10", 1, "pokemon", "single", 195),
      seedRow("Luffy Gear 5 Parallel", "OP-07", "Raw NM", 1, "onepiece"),
    ],
  },
  {
    id: "p2", name: "Personal PC", accent: "var(--purple)",
    rows: [
      seedRow("Lugia 1st Ed", "Neo Genesis", "PSA 9", 1, "pokemon"),
      seedRow("Pikachu Illustrator (proxy)", "Promo", "Raw LP", 1, "pokemon"),
      seedRow("Shanks Manga Parallel", "OP-01", "PSA 10", 1, "onepiece"),
    ],
  },
  {
    id: "p3", name: "GrailzCo Stock", accent: "var(--amber)",
    rows: [
      seedRow("Patrick Mahomes Rookie", "Prizm", "PSA 10", 1, "football", "double"),
      seedRow("LeBron James Prizm Silver", "Prizm", "PSA 9", 1, "basketball", "double"),
      seedRow("Mike Trout Chrome Refractor", "Bowman Chrome", "PSA 9", 1, "baseball", "double"),
      seedRow("Justin Jefferson Optic", "Optic", "Raw NM", 2, "football", "double"),
    ],
  },
];

/* ---------------- small shared UI pieces ---------------- */

function FitText({ text, className, maxSize = 11.5, minSize = 6, style }) {
  const ref = useRef(null);
  const [fontSize, setFontSize] = useState(maxSize);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    let size = maxSize;
    el.style.fontSize = size + "px";
    while (el.scrollWidth > el.clientWidth && size > minSize) { size -= 0.5; el.style.fontSize = size + "px"; }
    setFontSize(size);
  }, [text, maxSize, minSize]);
  return <div ref={ref} className={className} style={{ ...style, fontSize, whiteSpace: "nowrap", overflow: "hidden" }}>{text}</div>;
}

function TrendTag({ pct }) {
  if (pct === null || pct === undefined) return <span className="ht-mono text-xs" style={{ color: "var(--muted)" }}>—</span>;
  const up = pct >= 0;
  return (
    <span className="inline-flex items-center gap-1 ht-mono text-xs font-semibold" style={{ color: up ? "var(--green)" : "var(--red)" }}>
      {up ? <TrendingUp size={11} /> : <TrendingDown size={11} />}{Math.abs(pct)}%
    </span>
  );
}

// ---- price history chart (Portfolio card/sealed product detail) ----
const RANGE_OPTIONS = [
  { key: "1d", label: "1D", points: 24 },
  { key: "3d", label: "3D", points: 18 },
  { key: "7d", label: "7D", points: 14 },
  { key: "1mo", label: "1M", points: 30 },
  { key: "3mo", label: "3M", points: 26 },
  { key: "6mo", label: "6M", points: 26 },
  { key: "1yr", label: "1Y", points: 24 },
  { key: "all", label: "All", points: 30 },
];

// Deterministic pseudo-random walk that always lands exactly on currentPrice
// at the last point — stands in for a real historical-sales time series
// (Card Ladder / PriceCharting would supply this in production).
function generatePriceHistory(seedKey, currentPrice, points) {
  const base = currentPrice > 0 ? currentPrice : 1;
  let h = hashStr(seedKey);
  let val = base * (0.7 + (h % 40) / 100);
  const walk = [];
  for (let i = 0; i < points - 1; i++) {
    h = (h * 9301 + 49297) % 233280;
    const rnd = h / 233280;
    val = Math.max(base * 0.1, val + (rnd - 0.48) * base * 0.07);
    walk.push(val);
  }
  walk.push(currentPrice);
  return walk;
}

function PriceHistoryChart({ points, width = 343, height = 160 }) {
  const min = Math.min(...points);
  const max = Math.max(...points);
  const spread = max - min || 1;
  const positive = points[points.length - 1] >= points[0];
  const color = positive ? "var(--green)" : "var(--red)";
  const stepX = width / (points.length - 1);
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"} ${(i * stepX).toFixed(1)} ${(height - ((p - min) / spread) * (height - 8) - 4).toFixed(1)}`).join(" ");
  const areaPath = `${path} L ${width} ${height} L 0 ${height} Z`;
  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id="phcFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#phcFill)" />
      <path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CatDot({ category }) {
  const colors = { pokemon: "#F5C94A", onepiece: "#F87171", football: "#C98A4B", basketball: "#F5A524", baseball: "#5B9BF5" };
  return <span style={{ width: 6, height: 6, borderRadius: 999, background: colors[category] || "var(--muted)", display: "inline-block" }} />;
}

function Sparkline({ seed, positive, width = 132, height = 40 }) {
  const points = useMemo(() => {
    let h = hashStr(String(seed));
    const n = 14;
    let val = 50;
    const arr = [];
    for (let i = 0; i < n; i++) {
      h = (h * 9301 + 49297) % 233280;
      const rnd = h / 233280;
      val += (rnd - 0.44 + (positive ? 0.12 : -0.12)) * 20;
      val = Math.max(8, Math.min(92, val));
      arr.push(val);
    }
    return arr;
  }, [seed, positive]);
  const stepX = width / (points.length - 1);
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"} ${(i * stepX).toFixed(1)} ${(height - (p / 100) * height).toFixed(1)}`).join(" ");
  const color = positive ? "var(--green)" : "var(--red)";
  const areaPath = `${path} L ${width} ${height} L 0 ${height} Z`;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <defs>
        <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#sparkFill)" />
      <path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SectionHeader({ title, action, onAction }) {
  return (
    <div className="flex items-center justify-between mb-2 mt-5 px-4">
      <h2 className="text-sm font-semibold" style={{ color: "var(--text)" }}>{title}</h2>
      {action && <button onClick={onAction} className="text-xs" style={{ color: "var(--cyan)" }}>{action}</button>}
    </div>
  );
}

/* ---------------- app ---------------- */

export default function HoloHQApp() {
  const [tab, setTab] = useState("home");
  const [portfolios, setPortfolios] = useState(SEED_PORTFOLIOS);
  const [activePortfolioId, setActivePortfolioId] = useState(null);
  const [portfolioSection, setPortfolioSection] = useState("cards");
  const [cardDetail, setCardDetail] = useState(null);
  const [sealedDetail, setSealedDetail] = useState(null);
  const [chartRange, setChartRange] = useState("1mo");
  const [chartCondition, setChartCondition] = useState("Raw NM");
  const [gradeMode, setGradeMode] = useState("raw");
  const [chartOpen, setChartOpen] = useState(true);
  const [cardAddPickerOpen, setCardAddPickerOpen] = useState(false);
  const [sealedAddPickerOpen, setSealedAddPickerOpen] = useState(false);
  const [detailAddConfirm, setDetailAddConfirm] = useState("");
  const openCardDetail = (row) => { const cond = CONDITION_MULT[row.condition] != null ? row.condition : "Raw NM"; setCardDetail(row); setChartRange("1mo"); setChartCondition(cond); setGradeMode(cond.startsWith("Raw ") ? "raw" : "graded"); setChartOpen(true); setCardAddPickerOpen(false); };
  const openSealedDetail = (item) => { setSealedDetail(item); setChartRange("1mo"); setSealedAddPickerOpen(false); };
  const addCardDetailToPortfolio = (portfolioId) => { haptic(40);
    const r = cardDetail;
    if (!r) return;
    const seeded = seedRow(r.name, r.set || "", chartCondition || r.condition || "Raw NM", 1, r.category);
    setPortfolios(ps => ps.map(p => (p.id === portfolioId ? { ...p, rows: [...p.rows, seeded] } : p)));
    setCardAddPickerOpen(false);
    setDetailAddConfirm("Added to portfolio");
    setTimeout(() => setDetailAddConfirm(""), 1600);
  };
  const addSealedDetailToPortfolio = (portfolioId) => {
    const p = sealedDetail;
    if (!p) return;
    const item = { id: `${Date.now()}`, productName: p.productName, category: p.category, qty: 1, costEach: p.costEach ?? 0, marketEach: p.marketEach ?? 0 };
    setSealedPortfolios(sps => sps.map(sp => (sp.id === portfolioId ? { ...sp, items: [item, ...sp.items] } : sp)));
    setSealedAddPickerOpen(false);
    setDetailAddConfirm("Added to portfolio");
    setTimeout(() => setDetailAddConfirm(""), 1600);
  };
  const [homeCategory, setHomeCategory] = useState("all");
  const [homeMoverTab, setHomeMoverTab] = useState("gainers");
  const [homeTrendSection, setHomeTrendSection] = useState("cards");
  const [toolsView, setToolsView] = useState("menu");
  const DEFAULT_TOOLS_ORDER = {
    pricing: ["calculator", "trade", "crosslist", "repricing"],
    grading: ["psa", "grading", "gradepredict", "condition"],
    business: ["taxexport", "insurance"],
    data: ["bulkscan", "backup"],
  };
  // Merges a saved layout with the current defaults: drops tools that no longer
  // exist and appends any newly-added tools, so updates always surface new tools
  // even for users with a customized (persisted) order.
  const normalizeToolsOrder = (saved) => {
    const out = {};
    for (const cat of Object.keys(DEFAULT_TOOLS_ORDER)) {
      const savedList = (saved?.[cat] || []).filter(k => DEFAULT_TOOLS_ORDER[cat].includes(k));
      const missing = DEFAULT_TOOLS_ORDER[cat].filter(k => !savedList.includes(k));
      out[cat] = [...savedList, ...missing];
    }
    return out;
  };
  const [toolsOrder, setToolsOrder] = useState(DEFAULT_TOOLS_ORDER);
  const [toolsReorderMode, setToolsReorderMode] = useState(false);
  const [storeOrder, setStoreOrder] = useState(["pos", "kiosk", "sales", "topsellers", "wantlist", "expenses", "fees", "connect"]);
  const [storeReorderMode, setStoreReorderMode] = useState(false);
  // ---- kiosk / showcase mode (My Store) ----
  const [kioskSource, setKioskSource] = useState("all"); // "all" | "p:<id>" | "sp:<id>"
  const [kioskCategory, setKioskCategory] = useState("all");
  const [kioskSort, setKioskSort] = useState("priceHigh");
  const [kioskSearch, setKioskSearch] = useState("");
  const [exploreTrendingPage, setExploreTrendingPage] = useState(0);
  const [tickerHidden, setTickerHidden] = useState(false);
  const [exploreTrendSection, setExploreTrendSection] = useState("cards");
  const [portfolioMoverTab, setPortfolioMoverTab] = useState("gainers");
  const [allItemsOpen, setAllItemsOpen] = useState(false);
  const [allItemsFilter, setAllItemsFilter] = useState("all");
  const [allItemsSearch, setAllItemsSearch] = useState("");
  const [allItemsSort, setAllItemsSort] = useState("value");
  const [allItemsChartRange, setAllItemsChartRange] = useState("1mo");
  const [portfolioDetailSearch, setPortfolioDetailSearch] = useState("");
  const [portfolioListSearchOpen, setPortfolioListSearchOpen] = useState(false);
  const [portfolioListSearch, setPortfolioListSearch] = useState("");
  // ---- drag-to-reorder portfolios on the main page ----
  const [portfolioReorderMode, setPortfolioReorderMode] = useState(false);
  const pfDragRef = useRef(null);
  const [pfDragIdx, setPfDragIdx] = useState(null);
  // Generic pointer-drag for any reorderable grid/list. `kind` scopes which rows
  // count as drop targets; `applyMove(from, to)` performs the reorder.
  const gridDragRef = useRef(null);
  const [gridDragKey, setGridDragKey] = useState(null);
  const startGridDrag = (e, kind, idx, applyMove) => {
    e.preventDefault();
    gridDragRef.current = { kind, idx, applyMove };
    setGridDragKey(`${kind}:${idx}`);
    const onMove = (ev) => {
      const el = document.elementFromPoint(ev.clientX, ev.clientY);
      const row = el && el.closest(`[data-dragrow="${kind}"]`);
      if (!row) return;
      const to = Number(row.dataset.idx);
      const cur = gridDragRef.current;
      if (cur && Number.isFinite(to) && to !== cur.idx) {
        cur.applyMove(cur.idx, to);
        gridDragRef.current = { ...cur, idx: to };
        setGridDragKey(`${kind}:${to}`);
      }
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      gridDragRef.current = null;
      setGridDragKey(null);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };
  const moveToolByDrag = (categoryKey) => (from, to) => {
    setToolsOrder(o => {
      const arr = [...o[categoryKey]];
      const [item] = arr.splice(from, 1);
      arr.splice(to, 0, item);
      return { ...o, [categoryKey]: arr };
    });
  };
  const moveStoreByDrag = (from, to) => {
    setStoreOrder(o => {
      const arr = [...o];
      const [item] = arr.splice(from, 1);
      arr.splice(to, 0, item);
      return arr;
    });
  };
  const startPortfolioDrag = (e, list, idx) => {
    if (!portfolioReorderMode) return;
    e.preventDefault();
    pfDragRef.current = { list, idx };
    setPfDragIdx(idx);
    const setter = list === "cards" ? setPortfolios : setSealedPortfolios;
    const onMove = (ev) => {
      const el = document.elementFromPoint(ev.clientX, ev.clientY);
      const row = el && el.closest(`[data-pfrow="${list}"]`);
      if (!row) return;
      const to = Number(row.dataset.idx);
      const cur = pfDragRef.current;
      if (cur && Number.isFinite(to) && to !== cur.idx) {
        setter(arr => {
          const a = [...arr];
          const [item] = a.splice(cur.idx, 1);
          a.splice(to, 0, item);
          return a;
        });
        pfDragRef.current = { list, idx: to };
        setPfDragIdx(to);
      }
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      pfDragRef.current = null;
      setPfDragIdx(null);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };
  const [portfolioSealedMoverTab, setPortfolioSealedMoverTab] = useState("gainers");
  // trend % for an owned sealed item — uses live trending data when we track that
  // product, otherwise a stable simulated value (same hash trick as elsewhere)
  const sealedItemTrendPct = (productName) => {
    const known = SEALED_TRENDING.find(t => t.productName.toLowerCase() === productName.toLowerCase());
    if (known) return known.changePct;
    return Math.round((((hashStr(`sealedtrend|${productName}`) % 400) - 150) / 10) * 10) / 10;
  };
  // ---- Home quick tools — user-picked shortcuts to their most-used tools ----
  const [quickTools, setQuickTools] = useState(["calculator", "condition", "crosslist", "bulkscan"]);
  const [quickToolsEditOpen, setQuickToolsEditOpen] = useState(false);
  const toggleQuickTool = (key) => setQuickTools(qt => qt.includes(key) ? qt.filter(k => k !== key) : (qt.length >= 8 ? qt : [...qt, key]));
  const [newPortfolioOpen, setNewPortfolioOpen] = useState(false);
  const [newPortfolioName, setNewPortfolioName] = useState("");

  // ---- pricer state (Tools > Price & Label) ----
  const [rows, setRows] = useState([]);
  const [isTagging, setIsTagging] = useState(false);
  const [tagIndex, setTagIndex] = useState(-1);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [labelView, setLabelView] = useState(false);
  const fileRef = useRef(null);
  const logoRef = useRef(null);
  const [labelSettings, setLabelSettings] = useState({
    sellerName: "Holo Relix", logoDataUrl: null, qrContent: "", showQr: false,
    roundMode: "none", roundIncrement: 0.25, adjustPct: 0, labelsPerRow: 1, showMeta: false,
  });

  // ---- trade analyzer state ----
  const [tradeGive, setTradeGive] = useState([]);
  const [tradeGet, setTradeGet] = useState([]);

  // ---- calculator state (running total + percent breakdown) ----
  const [calcEntry, setCalcEntry] = useState("");
  const [calcTape, setCalcTape] = useState([]); // [{id, value}]

  /* ---------- derived: market-wide movers (not user portfolios) ---------- */
  const allRows = useMemo(() => portfolios.flatMap(p => p.rows.map(r => ({ ...r, portfolioName: p.name }))), [portfolios]);
  const totalValue = allRows.reduce((s, r) => s + (r.price || 0) * r.qty, 0);
  const avgTrend = allRows.length ? allRows.reduce((s, r) => s + (r.trendPct || 0), 0) / allRows.length : 0;
  const dollarChange = totalValue * (avgTrend / 100);
  const totalProfit = allRows.reduce((s, r) => s + (r.costBasis != null ? (r.price - r.costBasis) * r.qty : 0), 0);

  const activePortfolio = portfolios.find(p => p.id === activePortfolioId) || null;

  /* ---------- pricer logic ---------- */
  const runTag = useCallback(async () => {
    if (isTagging || rows.length === 0) return;
    setIsTagging(true);
    setRows(r => r.map(row => ({ ...row, status: "queued" })));
    for (let i = 0; i < rows.length; i++) {
      setTagIndex(i);
      setRows(r => r.map((row, idx) => (idx === i ? { ...row, status: "forging" } : row)));
      await new Promise(res => setTimeout(res, 180 + Math.random() * 140));
      setRows(r => r.map((row, idx) => {
        if (idx !== i) return row;
        if (!row.name.trim()) return { ...row, status: "priced", price: 0, trendPct: 0, comps: 0 };
        return { ...row, status: "priced", ...mockLookup(row.name, row.set, row.condition) };
      }));
    }
    setTagIndex(-1); setIsTagging(false);
  }, [rows, isTagging]);

  const loadPortfolioIntoPricer = (portfolio) => {
    setRows(portfolio.rows.map(r => ({ ...r, id: `${r.id}-copy-${Math.random().toString(36).slice(2, 6)}`, selected: true })));
    setTab("tools"); setToolsView("pricer");
  };

  const importCSV = (file) => {
    Papa.parse(file, {
      skipEmptyLines: true,
      complete: (res) => {
        const parsed = res.data.filter(c => c.some(x => String(x).trim() !== "")).map(cols => {
          const [name = "", set = "", condition = "Raw NM", qty = "1"] = cols;
          const cond = CONDITIONS.includes(String(condition).trim()) ? String(condition).trim() : "Raw NM";
          return makeRow(String(name).trim(), String(set).trim(), cond, Number(qty) || 1);
        });
        if (parsed.length) setRows(r => [...r, ...parsed]);
      },
    });
  };
  const importPaste = () => {
    const lines = pasteText.split("\n").map(l => l.trim()).filter(Boolean);
    const parsed = lines.map(line => {
      const [name = "", set = "", condition = "Raw NM", qty = "1"] = line.split(",").map(p => p.trim());
      const cond = CONDITIONS.includes(condition) ? condition : "Raw NM";
      return makeRow(name, set, cond, Number(qty) || 1);
    });
    if (parsed.length) setRows(r => [...r, ...parsed]);
    setPasteText(""); setPasteOpen(false);
  };
  const updateRow = (id, patch) => setRows(r => r.map(row => (row.id === id ? { ...row, ...patch } : row)));
  const removeRow = (id) => setRows(r => r.filter(row => row.id !== id));
  const handleLogoUpload = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => setLabelSettings(s => ({ ...s, logoDataUrl: e.target.result }));
    reader.readAsDataURL(file);
  };
  const printableRows = useMemo(() => rows.filter(r => r.status === "priced" && r.selected && r.name.trim()), [rows]);
  const qrUrl = labelSettings.qrContent.trim() ? `https://api.qrserver.com/v1/create-qr-code/?size=110x110&margin=0&data=${encodeURIComponent(labelSettings.qrContent.trim())}` : null;

  /* ---------- trade analyzer logic ---------- */
  const addTradeCard = (side) => {
    const row = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, name: "", condition: "Raw NM", qty: 1, price: 0 };
    if (side === "give") setTradeGive(r => [...r, row]); else setTradeGet(r => [...r, row]);
  };
  const updateTradeCard = (side, id, patch) => {
    const setter = side === "give" ? setTradeGive : setTradeGet;
    setter(r => r.map(row => (row.id === id ? { ...row, ...patch } : row)));
  };
  const lookupTradeCard = (side, id) => {
    const list = side === "give" ? tradeGive : tradeGet;
    const row = list.find(r => r.id === id);
    if (!row || !row.name.trim()) return;
    const { price } = mockLookup(row.name, "", row.condition);
    updateTradeCard(side, id, { price });
  };
  const removeTradeCard = (side, id) => {
    const setter = side === "give" ? setTradeGive : setTradeGet;
    setter(r => r.filter(row => row.id !== id));
  };
  const giveTotal = tradeGive.reduce((s, r) => s + (r.price || 0) * (r.qty || 1), 0);
  const getTotal = tradeGet.reduce((s, r) => s + (r.price || 0) * (r.qty || 1), 0);
  const tradeDiff = getTotal - giveTotal;
  const tradePctDiff = giveTotal ? (tradeDiff / giveTotal) * 100 : 0;
  const tradeVerdict = Math.abs(tradePctDiff) <= 5 ? "fair" : tradeDiff > 0 ? "win" : "lose";


  const calcTotal = calcTape.reduce((s, t) => s + t.value, 0);
  const PERCENTS = [70, 75, 80, 85, 90, 95];

  const pressDigit = (d) => {
    setCalcEntry(e => {
      if (d === "." && e.includes(".")) return e;
      if (e === "0" && d !== ".") return d;
      return e + d;
    });
  };
  const backspace = () => setCalcEntry(e => e.slice(0, -1));
  const clearEntry = () => setCalcEntry("");
  const addToTape = () => {
    const val = parseFloat(calcEntry);
    if (!val || val <= 0) return;
    setCalcTape(t => [...t, { id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, value: Math.round(val * 100) / 100 }]);
    setCalcEntry("");
  };
  const removeTapeItem = (id) => setCalcTape(t => t.filter(x => x.id !== id));
  const clearTape = () => { setCalcTape([]); setCalcEntry(""); };

  // ---- PSA cert lookup state ----
  const [certInput, setCertInput] = useState("");
  const [certResult, setCertResult] = useState(null);
  const [certLoading, setCertLoading] = useState(false);

  const runCertLookup = async () => {
    if (!certInput.trim() || certLoading) return;
    setCertLoading(true); setCertResult(null);
    try {
      const res = await fetch(`/api/psa?cert=${encodeURIComponent(certInput.trim())}&endpoint=cert`);
      const data = await res.json();
      if (data?.PSACert) {
        const c = data.PSACert;
        setCertResult({
          valid: true,
          certNumber: c.CertNumber,
          subject: c.Subject || c.Name || "Unknown",
          brand: c.Brand || c.Year || "",
          grade: c.CardGrade || c.Grade || "?",
          gradeDesc: c.GradeDescription || "",
          category: c.Category?.toLowerCase().includes("basketball") ? "basketball"
            : c.Category?.toLowerCase().includes("football") ? "football"
            : c.Category?.toLowerCase().includes("baseball") ? "baseball"
            : c.Category?.toLowerCase().includes("one piece") ? "onepiece"
            : "pokemon",
          population: null,
          source: "psa-live",
        });
      } else {
        // Fallback to mock if API returns unexpected format
        setCertResult(mockCertLookup(certInput));
      }
    } catch (e) {
      // Network error — fall back to mock
      setCertResult(mockCertLookup(certInput));
    }
    setCertLoading(false);
  };
  const addCertToPricer = () => {
    if (!certResult?.valid) return;
    const nameMode = ["basketball", "football", "baseball"].includes(certResult.category) ? "double" : "single";
    const row = makeRow(certResult.subject, certResult.brand, `PSA ${certResult.grade}`, 1, nameMode, certResult.category);
    setRows(r => [...r, row]);
    setTab("tools"); setToolsView("pricer");
  };

  // ---- Explore state ----
  const [exploreView, setExploreView] = useState("menu");
  const [selectedSet, setSelectedSet] = useState(MASTER_SETS[2].name);

  // ---- My Store state ----
  const [storeView, setStoreView] = useState("menu");
  const [salesLog, setSalesLog] = useState([
    { id: "s1", name: "Charizard VMAX (Rainbow)", price: 205, qty: 1, platform: "whatnot", date: "2026-07-14", paymentMethod: "digital" },
    { id: "s2", name: "Umbreon VMAX Alt Art", price: 315, qty: 1, platform: "ebay", date: "2026-07-16", paymentMethod: "digital" },
  ]);
  const [saleForm, setSaleForm] = useState({ name: "", price: "", qty: 1, platform: "inperson", paymentMethod: "cash", sourcePortfolioId: null, sourceRowId: null, sourcePortfolioName: null, sourceCostBasis: null });
  const [saleSearch, setSaleSearch] = useState("");
  const [sellingRowId, setSellingRowId] = useState(null);
  const [sellPrice, setSellPrice] = useState("");
  const [sellPlatform, setSellPlatform] = useState("whatnot");
  const [expenses, setExpenses] = useState([
    { id: "e1", label: "Card show table fee", category: "Booth Fee", amount: 75, date: "2026-07-12" },
    { id: "e2", label: "Top loaders + sleeves", category: "Supplies", amount: 22.5, date: "2026-07-10" },
  ]);
  const [expenseForm, setExpenseForm] = useState({ label: "", category: "Booth Fee", amount: "" });
  const [feePlatform, setFeePlatform] = useState("ebay");
  const [feeSalePrice, setFeeSalePrice] = useState(100);
  const [feeShipping, setFeeShipping] = useState(0);

  // ---- Profile state ----
  const [userTier, setUserTier] = useState("free");
  const isPro = userTier === "pro";
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [paywallTrigger, setPaywallTrigger] = useState("");
  const [paywallPlan, setPaywallPlan] = useState("monthly");
  const gate = (featureLabel) => {
    if (isPro) return true;
    setPaywallTrigger(featureLabel);
    setPaywallOpen(true);
    return false;
  };

  // ---- appearance ----
  const [colorMode, setColorMode] = useState("dark");
  const isDark = colorMode === "dark";

  // ---- onboarding ----
  const [onboardingDone, setOnboardingDone] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(0);
  const ONBOARDING_STEPS = [
    { icon: Layers, title: "Track your collection", body: "Add your cards and sealed products to portfolios and watch their market value in real time." },
    { icon: Tag, title: "Price & label instantly", body: "Look up any card, get a market price, and print professional price tag labels — fast enough for show setup." },
    { icon: CreditCard, title: "Run your booth like a business", body: "Ring up sales with the POS register, track expenses, export taxes, and showcase your inventory in Kiosk Mode." },
    { icon: Sparkles, title: "AI tools in your pocket", body: "Grade prediction, condition checking, and cross-listing to eBay, TCGplayer, and Whatnot — all in one place." },
  ];

  // ---- show mode (offline queue) ----
  const [showModeActive, setShowModeActive] = useState(false);
  const [showModeQueue, setShowModeQueue] = useState([]);
  const [isOnline, setIsOnline] = useState(true);
  const [syncingQueue, setSyncingQueue] = useState(false);
  useEffect(() => {
    const up = () => setIsOnline(true);
    const dn = () => setIsOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", dn);
    return () => { window.removeEventListener("online", up); window.removeEventListener("offline", dn); };
  }, []);
  const flushShowQueue = () => {
    if (!showModeQueue.length) return;
    setSyncingQueue(true);
    setTimeout(() => {
      setSalesLog(s => [...showModeQueue, ...s]);
      setShowModeQueue([]);
      setSyncingQueue(false);
    }, 900);
  };

  // ---- haptics ----
  const haptic = (ms = 40) => { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) {} };

  // ---- referral ----
  const [referralCode] = useState(() => `HOLOHQ-${Math.random().toString(36).slice(2, 7).toUpperCase()}`);
  const [referralCopied, setReferralCopied] = useState(false);
  const copyReferral = () => {
    navigator.clipboard?.writeText(referralCode).catch(() => {});
    setReferralCopied(true);
    haptic(30);
    setTimeout(() => setReferralCopied(false), 2000);
  };

  // ---- share card ----
  const [shareCardItem, setShareCardItem] = useState(null);
  const shareCard = (item) => {
    const text = item.kind === "sealed"
      ? `${item.productName} — $${item.marketEach?.toFixed(2)} on HoloHQ`
      : `${item.name} (${item.condition || "Raw NM"}) — $${(item.price || 0).toFixed(2)} on HoloHQ`;
    if (navigator.share) navigator.share({ title: "HoloHQ", text }).catch(() => {});
    else { navigator.clipboard?.writeText(text).catch(() => {}); setShareCardItem(item); setTimeout(() => setShareCardItem(null), 2000); }
    haptic(30);
  };

  // ---- CSV bulk import ----
  const [csvImportOpen, setCsvImportOpen] = useState(false);
  const [csvImportPortfolioId, setCsvImportPortfolioId] = useState("");
  const [csvImportResult, setCsvImportResult] = useState(null);
  const csvImportRef = useRef(null);
  const handleCsvImport = (file) => {
    Papa.parse(file, {
      header: true, skipEmptyLines: true,
      complete: (res) => {
        const rows = res.data.map((r, i) => {
          const name = r.name || r.Name || r.card || r.Card || "";
          const set = r.set || r.Set || "";
          const cond = r.condition || r.Condition || r.grade || r.Grade || "Raw NM";
          const qty = parseInt(r.qty || r.Qty || r.quantity || 1) || 1;
          const cost = parseFloat(r.cost || r.Cost || r.costBasis || 0) || 0;
          const cat = r.category || r.Category || "pokemon";
          if (!name) return null;
          return seedRow(name, set, cond, qty, cat, cost);
        }).filter(Boolean);
        setCsvImportResult({ rows, fileName: file.name });
      },
      error: () => setCsvImportResult({ rows: [], error: true }),
    });
  };
  const confirmCsvImport = () => {
    if (!csvImportResult?.rows?.length || !csvImportPortfolioId) return;
    setPortfolios(ps => ps.map(p => p.id === csvImportPortfolioId ? { ...p, rows: [...p.rows, ...csvImportResult.rows] } : p));
    haptic(60);
    setCsvImportOpen(false);
    setCsvImportResult(null);
    setCsvImportPortfolioId("");
  };
  const [profileName, setProfileName] = useState("Steezy");
  const [profileUsername, setProfileUsername] = useState("steezy");
  const [profileAvatar, setProfileAvatar] = useState(null);
  const [profileEmail, setProfileEmail] = useState("");
  const [twoFAEnabled, setTwoFAEnabled] = useState(false);
  const avatarRef = useRef(null);

  // ---- team / multi-user roles (Profile) ----
  const [team, setTeam] = useState([
    { id: "t1", name: "Steezy", email: "steezy@holorelix.com", role: "admin" },
  ]);
  const [teamForm, setTeamForm] = useState({ name: "", email: "", role: "employee" });
  const addTeamMember = () => {
    if (!teamForm.name.trim() || !teamForm.email.trim()) return;
    setTeam(t => [...t, { id: `${Date.now()}`, name: teamForm.name.trim(), email: teamForm.email.trim(), role: teamForm.role }]);
    setTeamForm({ name: "", email: "", role: "employee" });
  };
  const removeTeamMember = (id) => setTeam(t => t.filter(m => m.id !== id));
  const setTeamRole = (id, role) => setTeam(t => t.map(m => (m.id === id ? { ...m, role } : m)));

  // ---- grading submission tracker (Tools) ----
  const [gradingSubs, setGradingSubs] = useState([
    { id: "g1", cardName: "Charizard 4/102 Base Set", company: "psa", tier: "Express", declaredValue: 400, submittedDate: "2026-06-28", status: "Grading" },
    { id: "g2", cardName: "Umbreon VMAX Alt Art", company: "cgc", tier: "Standard", declaredValue: 300, submittedDate: "2026-07-05", status: "Received" },
  ]);
  const [gradingForm, setGradingForm] = useState({ cardName: "", company: "psa", tier: GRADING_COMPANIES.psa.tiers[1], declaredValue: "" });
  const addGradingSub = () => {
    if (!gradingForm.cardName.trim()) return;
    setGradingSubs(g => [{ id: `${Date.now()}`, cardName: gradingForm.cardName.trim(), company: gradingForm.company, tier: gradingForm.tier, declaredValue: Number(gradingForm.declaredValue) || 0, submittedDate: new Date().toISOString().slice(0, 10), status: "Submitted" }, ...g]);
    setGradingForm({ cardName: "", company: gradingForm.company, tier: gradingForm.tier, declaredValue: "" });
  };
  const advanceGradingStatus = (id) => setGradingSubs(g => g.map(s => {
    if (s.id !== id) return s;
    const idx = GRADING_STATUSES.indexOf(s.status);
    return idx < GRADING_STATUSES.length - 1 ? { ...s, status: GRADING_STATUSES[idx + 1] } : s;
  }));
  const removeGradingSub = (id) => setGradingSubs(g => g.filter(s => s.id !== id));

  // ---- watchlist + price alerts (now its own top-level tab) ----
  const [watchlist, setWatchlist] = useState([
    { id: "w1", kind: "card", name: "Rayquaza VMAX Alt Art", set: "Evolving Skies", category: "pokemon", targetPrice: 250, direction: "below" },
    { id: "w2", kind: "card", name: "Lugia 1st Edition", set: "Neo Genesis", category: "pokemon", targetPrice: 4500, direction: "above" },
  ]);
  const [watchForm, setWatchForm] = useState({ name: "", set: "", category: "pokemon", targetPrice: "", direction: "below" });
  const addWatch = () => {
    if (!watchForm.name.trim() || !watchForm.targetPrice) return;
    if (!isPro && watchlist.length >= FREE_LIMITS.watchlist) { gate("Unlimited watchlist alerts"); return; }
    haptic(30); setWatchlist(w => [{ id: `${Date.now()}`, kind: "card", name: watchForm.name.trim(), set: watchForm.set.trim(), category: watchForm.category, targetPrice: Number(watchForm.targetPrice) || 0, direction: watchForm.direction }, ...w]);
    setWatchForm({ name: "", set: "", category: watchForm.category, targetPrice: "", direction: watchForm.direction });
  };
  const removeWatch = (id) => setWatchlist(w => w.filter(x => x.id !== id));
  const updateWatchTarget = (id, targetPrice) => setWatchlist(w => w.map(x => (x.id === id ? { ...x, targetPrice } : x)));

  // quick add/remove from a specific card row or sealed product row
  const isCardWatched = (row) => watchlist.some(w => w.kind === "card" && w.name === row.name && w.set === row.set);
  const toggleCardWatch = (row) => {
    setWatchlist(w => {
      const existing = w.find(x => x.kind === "card" && x.name === row.name && x.set === row.set);
      if (existing) return w.filter(x => x.id !== existing.id);
      return [{ id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, kind: "card", name: row.name, set: row.set, category: row.category, targetPrice: row.price ?? 0, direction: "below" }, ...w];
    });
  };
  const isSealedWatched = (item) => watchlist.some(w => w.kind === "sealed" && w.name === item.productName);
  const toggleSealedWatch = (item) => {
    setWatchlist(w => {
      const existing = w.find(x => x.kind === "sealed" && x.name === item.productName);
      if (existing) return w.filter(x => x.id !== existing.id);
      return [{ id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, kind: "sealed", name: item.productName, set: "", category: item.category, targetPrice: item.marketEach, direction: "below" }, ...w];
    });
  };


  // ---- customer want list (My Store) ----
  const [wantList, setWantList] = useState([
    { id: "wl1", customerName: "Dre", contact: "@dre_pulls", cardName: "Umbreon VMAX Alt Art", maxPrice: 340, notes: "PSA 10 or raw NM only", status: "open" },
  ]);
  const [wantForm, setWantForm] = useState({ customerName: "", contact: "", cardName: "", maxPrice: "", notes: "" });
  const addWant = () => {
    if (!wantForm.customerName.trim() || !wantForm.cardName.trim()) return;
    setWantList(w => [{ id: `${Date.now()}`, ...wantForm, customerName: wantForm.customerName.trim(), cardName: wantForm.cardName.trim(), maxPrice: Number(wantForm.maxPrice) || 0, status: "open" }, ...w]);
    setWantForm({ customerName: "", contact: "", cardName: "", maxPrice: "", notes: "" });
  };
  const toggleWantStatus = (id) => setWantList(w => w.map(x => (x.id === id ? { ...x, status: x.status === "open" ? "fulfilled" : "open" } : x)));
  const removeWant = (id) => setWantList(w => w.filter(x => x.id !== id));

  // ---- sealed product inventory, organized into separate portfolios (Portfolio > Sealed) ----
  const [sealedPortfolios, setSealedPortfolios] = useState([
    {
      id: "sp1", name: "Show Inventory", accent: "var(--green)",
      items: [
        { id: "spi1", productName: "Evolving Skies Booster Box", category: "pokemon", qty: 3, costEach: 145, marketEach: 285 },
        { id: "spi2", productName: "OP-07 Booster Box", category: "onepiece", qty: 5, costEach: 90, marketEach: 118 },
      ],
    },
    { id: "sp2", name: "Personal Stash", accent: "var(--purple)", items: [] },
  ]);
  const [activeSealedPortfolioId, setActiveSealedPortfolioId] = useState(null);
  const [newSealedPortfolioOpen, setNewSealedPortfolioOpen] = useState(false);
  const [newSealedPortfolioName, setNewSealedPortfolioName] = useState("");
  const [sealedForm, setSealedForm] = useState({ productName: "", category: "pokemon", qty: "1", costEach: "", marketEach: "" });
  const addSealed = () => {
    if (!sealedForm.productName.trim() || !activeSealedPortfolioId) return;
    const item = { id: `${Date.now()}`, productName: sealedForm.productName.trim(), category: sealedForm.category, qty: Number(sealedForm.qty) || 1, costEach: Number(sealedForm.costEach) || 0, marketEach: Number(sealedForm.marketEach) || 0 };
    setSealedPortfolios(sp => sp.map(p => (p.id === activeSealedPortfolioId ? { ...p, items: [item, ...p.items] } : p)));
    setSealedForm({ productName: "", category: sealedForm.category, qty: "1", costEach: "", marketEach: "" });
  };
  const removeSealed = (itemId) => setSealedPortfolios(sp => sp.map(p => (p.id === activeSealedPortfolioId ? { ...p, items: p.items.filter(x => x.id !== itemId) } : p)));
  const activeSealedPortfolio = sealedPortfolios.find(p => p.id === activeSealedPortfolioId) || null;
  const sealedInventory = useMemo(() => sealedPortfolios.flatMap(p => p.items), [sealedPortfolios]);
  // ---- combined totals for the Home hero (cards + sealed) ----
  const sealedTotalValue = sealedInventory.reduce((s, i) => s + i.marketEach * i.qty, 0);
  const sealedTotalProfit = sealedInventory.reduce((s, i) => s + (i.marketEach - i.costEach) * i.qty, 0);
  const sealedAvgTrend = sealedInventory.length ? sealedInventory.reduce((s, i) => s + sealedItemTrendPct(i.productName), 0) / sealedInventory.length : 0;
  const grandTotalValue = totalValue + sealedTotalValue;
  const grandTotalProfit = totalProfit + sealedTotalProfit;
  // blend the trend, weighted by each side's share of total value
  const grandAvgTrend = grandTotalValue > 0 ? (avgTrend * totalValue + sealedAvgTrend * sealedTotalValue) / grandTotalValue : 0;
  const grandDollarChange = grandTotalValue * (grandAvgTrend / 100);

  const watchlistWithPrices = useMemo(() => watchlist.map(w => {
    if (w.kind === "sealed") {
      const match = sealedInventory.find(i => i.productName === w.name);
      const price = match ? match.marketEach : w.targetPrice;
      const triggered = w.direction === "below" ? price <= w.targetPrice : price >= w.targetPrice;
      return { ...w, currentPrice: price, trendPct: null, triggered };
    }
    const { price, trendPct } = mockLookup(w.name, w.set, "Raw NM");
    const triggered = w.direction === "below" ? price <= w.targetPrice : price >= w.targetPrice;
    return { ...w, currentPrice: price, trendPct, triggered };
  }), [watchlist, sealedInventory]);


  // ---- POS / Register mode (My Store) ----
  const [posLinks, setPosLinks] = useState({ zelle: "", venmo: "", cashapp: "", paypal: "", shopify: "", cash: "true" });
  const [posConnected, setPosConnected] = useState({});
  const togglePosConnected = (key) => setPosConnected(c => ({ ...c, [key]: !c[key] }));
  const [posCart, setPosCart] = useState([]);
  const [posItemForm, setPosItemForm] = useState({ name: "", price: "" });
  const [posPayMethod, setPosPayMethod] = useState("cash");
  const [posCharged, setPosCharged] = useState(false);
  const addPosItem = () => {
    if (!posItemForm.name.trim() || !posItemForm.price) return;
    setPosCart(c => [...c, { id: `${Date.now()}`, name: posItemForm.name.trim(), price: Number(posItemForm.price) || 0 }]);
    setPosItemForm({ name: "", price: "" });
  };
  const removePosItem = (id) => setPosCart(c => c.filter(x => x.id !== id));
  const posTotal = posCart.reduce((s, i) => s + i.price, 0);
  const completePosSale = () => {
    if (posCart.length === 0) return;
    const method = posPayMethod === "cash" ? "cash" : "digital";
    haptic(60); setSalesLog(s => [{ id: `${Date.now()}`, name: posCart.length === 1 ? posCart[0].name : `${posCart.length} items`, price: posTotal, qty: 1, platform: "inperson", date: new Date().toISOString().slice(0, 10), portfolioName: null, costBasis: null, paymentMethod: method }, ...s]);
    setPosCharged(true);
    setTimeout(() => { setPosCharged(false); setPosCart([]); }, 1600);
  };

  // ---- bulk photo intake (Tools) ----
  const [capturedPhotos, setCapturedPhotos] = useState([]);
  const [isScanning, setIsScanning] = useState(false);
  const bulkPhotoRef = useRef(null);
  const runBulkScan = async (files) => {
    const list = Array.from(files);
    const items = list.map(f => ({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, fileName: f.name, dataUrl: null, status: "queued", card: null }));
    setCapturedPhotos(p => [...p, ...items]);
    list.forEach((f, i) => {
      const reader = new FileReader();
      reader.onload = (e) => setCapturedPhotos(p => p.map(x => (x.id === items[i].id ? { ...x, dataUrl: e.target.result } : x)));
      reader.readAsDataURL(f);
    });
    setIsScanning(true);
    for (let i = 0; i < items.length; i++) {
      setCapturedPhotos(p => p.map(x => (x.id === items[i].id ? { ...x, status: "scanning" } : x)));
      await new Promise(res => setTimeout(res, 250 + Math.random() * 200));
      const guess = SEARCH_CARDS[hashStr(items[i].id) % SEARCH_CARDS.length];
      const { price, trendPct } = mockLookup(guess.name, guess.set, "Raw NM");
      setCapturedPhotos(p => p.map(x => (x.id === items[i].id ? { ...x, status: "matched", card: { ...guess, price, trendPct } } : x)));
    }
    setIsScanning(false);
  };
  const removeCapturedPhoto = (id) => setCapturedPhotos(p => p.filter(x => x.id !== id));
  const addAllScannedToPortfolio = (portfolioId) => {
    const matched = capturedPhotos.filter(p => p.status === "matched" && p.card);
    if (!matched.length) return;
    const newRows = matched.map(p => seedRow(p.card.name, p.card.set, "Raw NM", 1, p.card.category));
    setPortfolios(ps => ps.map(pf => (pf.id === portfolioId ? { ...pf, rows: [...pf.rows, ...newRows] } : pf)));
    setCapturedPhotos(p => p.filter(x => x.status !== "matched"));
  };

  // ---- cross-listing to marketplaces (Tools) ----
  const [crossListings, setCrossListings] = useState([]);
  const [crossListForm, setCrossListForm] = useState({ portfolioId: "", rowId: "", platforms: [] });
  const toggleCrossListPlatform = (key) => setCrossListForm(f => ({ ...f, platforms: f.platforms.includes(key) ? f.platforms.filter(p => p !== key) : [...f.platforms, key] }));
  const publishCrossListing = () => {
    const portfolio = portfolios.find(p => p.id === crossListForm.portfolioId);
    const row = portfolio?.rows.find(r => r.id === crossListForm.rowId);
    if (!row || crossListForm.platforms.length === 0) return;
    setCrossListings(l => [{ id: `${Date.now()}`, cardName: row.name, set: row.set, price: row.price, platforms: crossListForm.platforms, status: "listed", listedAt: new Date().toISOString().slice(0, 10) }, ...l]);
    setCrossListForm({ portfolioId: "", rowId: "", platforms: [] });
  };
  const removeCrossListing = (id) => setCrossListings(l => l.filter(x => x.id !== id));
  const CROSSLIST_PLATFORMS = [
    { key: "ebay", label: "eBay" }, { key: "tcgplayer", label: "TCGplayer" },
    { key: "whatnot", label: "Whatnot" }, { key: "shopify", label: "Shopify" },
  ];

  // ---- auto repricing rules (Tools) ----
  const [repricingRules, setRepricingRules] = useState([]);
  const [repricingForm, setRepricingForm] = useState({ portfolioId: "", mode: "undercut", adjustPct: "5" });
  const addRepricingRule = () => {
    if (!repricingForm.portfolioId) return;
    setRepricingRules(r => [{ id: `${Date.now()}`, portfolioId: repricingForm.portfolioId, mode: repricingForm.mode, adjustPct: Number(repricingForm.adjustPct) || 0, enabled: true }, ...r]);
    setRepricingForm({ portfolioId: "", mode: repricingForm.mode, adjustPct: repricingForm.adjustPct });
  };
  const toggleRepricingRule = (id) => setRepricingRules(r => r.map(x => (x.id === id ? { ...x, enabled: !x.enabled } : x)));
  const removeRepricingRule = (id) => setRepricingRules(r => r.filter(x => x.id !== id));
  const suggestedPrice = (marketPrice, rule) => {
    if (rule.mode === "match") return marketPrice;
    if (rule.mode === "undercut") return marketPrice * (1 - rule.adjustPct / 100);
    return marketPrice * (1 + rule.adjustPct / 100);
  };
  const applyRepricing = (rule) => {
    setPortfolios(ps => ps.map(p => (p.id !== rule.portfolioId ? p : {
      ...p, rows: p.rows.map(r => (r.price != null ? { ...r, price: Math.round(suggestedPrice(r.price, rule) * 100) / 100 } : r)),
    })));
  };

  // ---- AI grade prediction (Tools) — "should I grade this?" ----
  const [gradePredictPhoto, setGradePredictPhoto] = useState(null);
  const [gradePredictForm, setGradePredictForm] = useState({ name: "", set: "" });
  const [gradePredictResult, setGradePredictResult] = useState(null);
  const [isPredictingGrade, setIsPredictingGrade] = useState(false);
  const gradePredictPhotoRef = useRef(null);
  const runGradePrediction = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => setGradePredictPhoto(e.target.result);
    reader.readAsDataURL(file);
    setIsPredictingGrade(true);
    setGradePredictResult(null);
    setTimeout(() => {
      const seed = hashStr(`${file.name}|${file.size}|${file.lastModified}|${gradePredictForm.name}`);
      // simulated probability mass across PSA outcomes, weighted by "photo quality"
      const quality = seed % 100; // 0-99
      let probs;
      if (quality >= 70) probs = { "PSA 10": 42, "PSA 9": 38, "PSA 8": 15, "PSA 7 or lower": 5 };
      else if (quality >= 40) probs = { "PSA 10": 18, "PSA 9": 44, "PSA 8": 28, "PSA 7 or lower": 10 };
      else probs = { "PSA 10": 5, "PSA 9": 25, "PSA 8": 42, "PSA 7 or lower": 28 };
      const predicted = Object.entries(probs).sort((a, b) => b[1] - a[1])[0][0];
      const cardName = gradePredictForm.name.trim() || "This card";
      const cardSet = gradePredictForm.set.trim();
      const rawValue = mockLookup(cardName, cardSet, "Raw NM").price;
      const psa10Value = mockLookup(cardName, cardSet, "PSA 10").price;
      const psa9Value = mockLookup(cardName, cardSet, "PSA 9").price;
      const gradingCost = 25; // PSA value tier ballpark
      const expectedValue = (probs["PSA 10"] / 100) * psa10Value + (probs["PSA 9"] / 100) * psa9Value + (probs["PSA 8"] / 100) * mockLookup(cardName, cardSet, "PSA 8").price + (probs["PSA 7 or lower"] / 100) * rawValue * 0.9;
      const roi = expectedValue - gradingCost - rawValue;
      setGradePredictResult({ probs, predicted, rawValue, psa10Value, psa9Value, gradingCost, expectedValue, roi, confidence: 55 + (seed % 35) });
      setIsPredictingGrade(false);
    }, 1600);
  };

  // ---- condition checker (Tools) ----
  const [conditionPhoto, setConditionPhoto] = useState(null);
  const [conditionResult, setConditionResult] = useState(null);
  const [isCheckingCondition, setIsCheckingCondition] = useState(false);
  const conditionPhotoRef = useRef(null);
  const runConditionCheck = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => setConditionPhoto(e.target.result);
    reader.readAsDataURL(file);
    setIsCheckingCondition(true);
    setConditionResult(null);
    setTimeout(() => {
      const seed = hashStr(`${file.name}|${file.size}|${file.lastModified}`);
      const centering = 5 + (seed % 6);
      const corners = 5 + ((seed >> 2) % 6);
      const edges = 5 + ((seed >> 4) % 6);
      const surface = 5 + ((seed >> 6) % 6);
      const avg = (centering + corners + edges + surface) / 4;
      const gradeEstimate = avg >= 9.3 ? "PSA 10 (Gem Mint)" : avg >= 8.5 ? "PSA 9 (Mint)" : avg >= 7 ? "PSA 8 / Raw NM" : avg >= 5 ? "Raw LP" : "Raw MP or lower";
      setConditionResult({ centering, corners, edges, surface, gradeEstimate, confidence: 60 + (seed % 35) });
      setIsCheckingCondition(false);
    }, 1400);
  };

  // ---- search state ----
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFullView, setSearchFullView] = useState(false);
  const [searchSort, setSearchSort] = useState("popularity");
  const [searchCategoryFilter, setSearchCategoryFilter] = useState("all");
  const [recentSearches, setRecentSearches] = useState([]);

  // Live Pokémon TCG API results




  const quickSearchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    const cards = ALL_SEARCH_CARDS.filter(c => (c.displayName || c.name).toLowerCase().includes(q) || c.name.toLowerCase().includes(q) || c.set.toLowerCase().includes(q)).map(c => ({ ...c, kind: "card" }));
    const sealed = ALL_SEARCH_SEALED.filter(t => t.productName.toLowerCase().includes(q)).map(t => ({ ...t, kind: "sealed" }));
    return [...cards, ...sealed].sort((a, b) => (b.popularity || 0) - (a.popularity || 0)).slice(0, 7);
  }, [searchQuery]);

  const fullSearchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let cards = ALL_SEARCH_CARDS.map(c => ({ ...c, kind: "card" }));
    let sealed = ALL_SEARCH_SEALED.map(t => ({ ...t, kind: "sealed" }));
    if (q) {
      cards = cards.filter(c => (c.displayName || c.name).toLowerCase().includes(q) || c.name.toLowerCase().includes(q) || (c.set || "").toLowerCase().includes(q));
      sealed = sealed.filter(t => t.productName.toLowerCase().includes(q));
    }
    let list = [...cards, ...sealed];
    if (searchCategoryFilter !== "all") list = list.filter(c => c.category === searchCategoryFilter);
    if (searchSort === "popularity") list.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
    else if (searchSort === "priceHigh") list.sort((a, b) => (b.price || 0) - (a.price || 0));
    else if (searchSort === "priceLow") list.sort((a, b) => (a.price || 0) - (b.price || 0));
    else if (searchSort === "name") list.sort((a, b) => (a.name || a.productName || "").localeCompare(b.name || b.productName || ""));
    return list;
  }, [searchQuery, searchCategoryFilter, searchSort]);

  const openSearchResult = (item) => {
    setRecentSearches(r => {
      const isSame = (c) => c.kind === item.kind && (item.kind === "sealed" ? c.productName === item.productName : c.name === item.name && c.set === item.set);
      return [item, ...r.filter(c => !isSame(c))].slice(0, 8);
    });
    if (item.kind === "sealed") openSealedDetail(item);
    else openCardDetail({ ...item, image: item.image || item.largeImage || findCatalogImage(item.name, item.set) });
  };
  const removeRecentSearch = (item) => setRecentSearches(r => r.filter(c => !(c.kind === item.kind && (item.kind === "sealed" ? c.productName === item.productName : c.name === item.name && c.set === item.set))));

  // Records a sale AND removes the card from its portfolio in one step —
  // used by both the Portfolio "Sell" button and the Sales Log's
  // search-your-portfolio flow, so the two stay consistent.
  const sellCard = (portfolioId, row, salePrice, platform) => {
    const portfolio = portfolios.find(p => p.id === portfolioId);
    setSalesLog(s => [{
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: row.name, price: salePrice, qty: row.qty, platform,
      date: new Date().toISOString().slice(0, 10),
      portfolioName: portfolio?.name || null, costBasis: row.costBasis ?? null,
      paymentMethod: platform === "inperson" ? "cash" : "digital",
    }, ...s]);
    setPortfolios(ps => ps.map(p => (p.id === portfolioId ? { ...p, rows: p.rows.filter(r => r.id !== row.id) } : p)));
  };

  const addSale = () => {
    if (!saleForm.name.trim() || !saleForm.price) return;
    if (saleForm.sourcePortfolioId && saleForm.sourceRowId) {
      const portfolio = portfolios.find(p => p.id === saleForm.sourcePortfolioId);
      const row = portfolio?.rows.find(r => r.id === saleForm.sourceRowId);
      if (row) {
        sellCard(saleForm.sourcePortfolioId, row, Number(saleForm.price) || 0, saleForm.platform);
        setSaleForm({ name: "", price: "", qty: 1, platform: saleForm.platform, paymentMethod: saleForm.paymentMethod, sourcePortfolioId: null, sourceRowId: null, sourcePortfolioName: null, sourceCostBasis: null });
        setSaleSearch("");
        return;
      }
    }
    setSalesLog(s => [{ id: `${Date.now()}`, name: saleForm.name.trim(), price: Number(saleForm.price) || 0, qty: Number(saleForm.qty) || 1, platform: saleForm.platform, date: new Date().toISOString().slice(0, 10), portfolioName: null, costBasis: null, paymentMethod: saleForm.paymentMethod }, ...s]);
    setSaleForm({ name: "", price: "", qty: 1, platform: saleForm.platform, paymentMethod: saleForm.paymentMethod, sourcePortfolioId: null, sourceRowId: null, sourcePortfolioName: null, sourceCostBasis: null });
    setSaleSearch("");
  };
  const selectSaleSource = (row, portfolioName, portfolioId) => {
    setSaleForm(f => ({ ...f, name: row.name, price: row.price ?? "", qty: row.qty, sourcePortfolioId: portfolioId, sourceRowId: row.id, sourcePortfolioName: portfolioName, sourceCostBasis: row.costBasis ?? null }));
    setSaleSearch("");
  };
  const clearSaleSource = () => setSaleForm(f => ({ ...f, sourcePortfolioId: null, sourceRowId: null, sourcePortfolioName: null, sourceCostBasis: null }));
  const removeSale = (id) => setSalesLog(s => s.filter(x => x.id !== id));
  const addExpense = () => {
    if (!expenseForm.label.trim() || !expenseForm.amount) return;
    setExpenses(e => [{ id: `${Date.now()}`, label: expenseForm.label.trim(), category: expenseForm.category, amount: Number(expenseForm.amount) || 0, date: new Date().toISOString().slice(0, 10) }, ...e]);
    setExpenseForm({ label: "", category: expenseForm.category, amount: "" });
  };
  const removeExpense = (id) => setExpenses(e => e.filter(x => x.id !== id));

  const salesRevenue = salesLog.reduce((s, r) => s + r.price * r.qty, 0);
  const digitalRevenue = salesLog.filter(r => isDigitalPayment(r.paymentMethod || (r.platform === "inperson" ? "cash" : "digital"))).reduce((s, r) => s + r.price * r.qty, 0);
  const cashRevenue = salesRevenue - digitalRevenue;
  const totalExpenses = expenses.reduce((s, r) => s + r.amount, 0);
  const estFeesOnSales = salesLog.reduce((s, r) => {
    const f = PLATFORM_FEES[r.platform] || PLATFORM_FEES.inperson;
    return s + (r.price * r.qty * f.pct) / 100 + f.flat;
  }, 0);
  const netProfit = salesRevenue - totalExpenses - estFeesOnSales;

  const feeInfo = PLATFORM_FEES[feePlatform];
  const feeGross = feeSalePrice + feeShipping;
  const feeAmount = (feeGross * feeInfo.pct) / 100 + feeInfo.flat;
  const feeNet = feeGross - feeAmount;

  const saleSearchResults = useMemo(() => {
    const q = saleSearch.trim().toLowerCase();
    if (!q) return [];
    return portfolios.flatMap(p => p.rows.filter(r => r.status === "priced" && r.name.toLowerCase().includes(q)).map(r => ({ row: r, portfolioName: p.name, portfolioId: p.id }))).slice(0, 8);
  }, [saleSearch, portfolios]);

  // ---- full backup export / import ----
  const buildBackupSnapshot = () => ({
    version: 1, exportedAt: new Date().toISOString(),
    portfolios, sealedPortfolios, watchlist, salesLog, expenses, gradingSubs, wantList, team,
    labelSettings, profileName, profileUsername, profileEmail, posLinks, recentSearches, crossListings, repricingRules, toolsOrder, storeOrder, quickTools, userTier, colorMode, onboardingDone,
  });
  const exportFullBackup = () => {
    const blob = new Blob([JSON.stringify(buildBackupSnapshot(), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `holohq_backup_${new Date().toISOString().slice(0, 10)}.json`; a.click(); URL.revokeObjectURL(url);
  };
  const backupFileRef = useRef(null);
  const [restoreMessage, setRestoreMessage] = useState("");
  const importFullBackup = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (data.portfolios) setPortfolios(data.portfolios);
        if (data.sealedPortfolios) setSealedPortfolios(data.sealedPortfolios);
        if (data.watchlist) setWatchlist(data.watchlist);
        if (data.salesLog) setSalesLog(data.salesLog);
        if (data.expenses) setExpenses(data.expenses);
        if (data.gradingSubs) setGradingSubs(data.gradingSubs);
        if (data.wantList) setWantList(data.wantList);
        if (data.team) setTeam(data.team);
        if (data.labelSettings) setLabelSettings(data.labelSettings);
        if (data.profileName) setProfileName(data.profileName);
        if (data.profileUsername) setProfileUsername(data.profileUsername);
        if (data.toolsOrder) setToolsOrder(normalizeToolsOrder(data.toolsOrder));
        if (data.storeOrder) setStoreOrder([...data.storeOrder.filter(k => STORE_META[k]), ...Object.keys(STORE_META).filter(k => !data.storeOrder.includes(k))]);
        if (data.quickTools) setQuickTools(data.quickTools.filter(k => TOOL_META[k]));
        if (data.userTier) setUserTier(data.userTier);
        if (data.colorMode) setColorMode(data.colorMode);
        if (data.onboardingDone) setOnboardingDone(data.onboardingDone);
        if (data.profileEmail) setProfileEmail(data.profileEmail);
        if (data.posLinks) setPosLinks(data.posLinks);
        if (data.recentSearches) setRecentSearches(data.recentSearches);
        if (data.crossListings) setCrossListings(data.crossListings);
        if (data.repricingRules) setRepricingRules(data.repricingRules);
        setRestoreMessage("Backup restored successfully.");
      } catch (err) {
        setRestoreMessage("Couldn't read that file — make sure it's a HoloHQ backup .json.");
      }
      setTimeout(() => setRestoreMessage(""), 3000);
    };
    reader.readAsText(file);
  };

  // ---- data persistence + multi-device sync (window.storage) ----
  const STORAGE_KEY = "holohq-data";
  const [hydrated, setHydrated] = useState(false);
  const [syncStatus, setSyncStatus] = useState("idle"); // idle | syncing | synced | error
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await window.storage.get(STORAGE_KEY);
        if (res && res.value && !cancelled) {
          const data = JSON.parse(res.value);
          if (data.portfolios) setPortfolios(data.portfolios);
          if (data.sealedPortfolios) setSealedPortfolios(data.sealedPortfolios);
          if (data.watchlist) setWatchlist(data.watchlist);
          if (data.salesLog) setSalesLog(data.salesLog);
          if (data.expenses) setExpenses(data.expenses);
          if (data.gradingSubs) setGradingSubs(data.gradingSubs);
          if (data.wantList) setWantList(data.wantList);
          if (data.team) setTeam(data.team);
          if (data.labelSettings) setLabelSettings(data.labelSettings);
          if (data.profileName) setProfileName(data.profileName);
        if (data.profileUsername) setProfileUsername(data.profileUsername);
        if (data.toolsOrder) setToolsOrder(normalizeToolsOrder(data.toolsOrder));
        if (data.storeOrder) setStoreOrder([...data.storeOrder.filter(k => STORE_META[k]), ...Object.keys(STORE_META).filter(k => !data.storeOrder.includes(k))]);
        if (data.quickTools) setQuickTools(data.quickTools.filter(k => TOOL_META[k]));
        if (data.userTier) setUserTier(data.userTier);
        if (data.colorMode) setColorMode(data.colorMode);
        if (data.onboardingDone) setOnboardingDone(data.onboardingDone);
          if (data.profileEmail) setProfileEmail(data.profileEmail);
          if (data.posLinks) setPosLinks(data.posLinks);
          if (data.recentSearches) setRecentSearches(data.recentSearches);
          if (data.crossListings) setCrossListings(data.crossListings);
          if (data.repricingRules) setRepricingRules(data.repricingRules);
        }
      } catch (e) {
        // nothing saved yet, or storage unavailable — proceed with the seeded demo data
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const saveTimer = useRef(null);
  useEffect(() => {
    if (!hydrated) return; // don't stomp saved data with initial defaults before the load above finishes
    setSyncStatus("syncing");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        await window.storage.set(STORAGE_KEY, JSON.stringify(buildBackupSnapshot()));
        setSyncStatus("synced");
      } catch (e) {
        setSyncStatus("error");
      }
    }, 700);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, portfolios, sealedPortfolios, watchlist, salesLog, expenses, gradingSubs, wantList, team, labelSettings, profileName, profileUsername, profileEmail, posLinks, recentSearches, crossListings, repricingRules, toolsOrder, storeOrder, quickTools, userTier, colorMode, onboardingDone]);

  // ---- cloud sync when logged in ----
  useEffect(() => {
    if (!supaUser) return;
    const timer = setTimeout(() => {
      const data = { portfolios, sealedPortfolios, watchlist, salesLog, userTier, profileName };
      saveUserData(supaUser.id, data);
    }, 2000);
    return () => clearTimeout(timer);
  }, [supaUser, portfolios, sealedPortfolios, watchlist, salesLog, userTier, profileName]);

  const NAV = [
    { key: "home", label: "Home", icon: HomeIcon },
    { key: "search", label: "Search", icon: Search },
    { key: "portfolio", label: "Portfolio", icon: Layers },
    { key: "explore", label: "Explore", icon: Compass },
    { key: "tools", label: "Tools", icon: Wrench },
    { key: "shop", label: "My Store", icon: ShoppingBag },
    { key: "profile", label: "Profile", icon: User },
  ];

  return (
    <div className="ht-root" data-mode={colorMode} style={{ minHeight: "100vh", width: "100%", position: "relative", overflowX: "hidden", paddingBottom: 74 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');
        @media screen {
          html, body, #root { background:#0A0912 !important; min-height:100%; margin:0; }
        }
        html, body {
          margin: 0 !important;
          padding: 0 !important;
          background: #0A0912 !important;
          width: 100% !important;
          overflow-x: hidden !important;
        }
        .ht-root {
          --void:#0A0912; --panel:#15121F; --panel-2:#1C1830; --line:#2A2440;
          --purple:#8B5CF6; --purple-deep:#5B21B6; --cyan:#2DD4E8;
          --text:#F1EEFA; --muted:#8A84A3; --green:#34D399; --red:#F87171; --amber:#F5A524;
          font-family:'Space Grotesk', sans-serif;
          font-size: 16px;
          background: #0A0912;
          color: #F1EEFA;
          width: 100%;
          min-width: 100%;
          overflow-x: hidden;
          box-sizing: border-box;
        }
        .ht-mono { font-family:'JetBrains Mono', monospace; }
        .ht-display { font-family:'Bebas Neue', sans-serif; letter-spacing:0.04em; }
        .ht-card { background:var(--panel); border:1px solid var(--line); border-radius:12px; }
        .ht-input { background:var(--panel-2); border:1px solid var(--line); color:var(--text); }
        .ht-input:focus { outline:none; border-color:var(--purple); }
        .ht-btn-primary { background:linear-gradient(135deg, var(--purple), var(--purple-deep)); transition:filter .15s ease, transform .1s ease; }
        .ht-btn-primary:hover:not(:disabled){ filter:brightness(1.12); }
        .ht-btn-primary:active:not(:disabled){ transform:scale(.98); }
        .ht-btn-primary:disabled{ opacity:.45; cursor:not-allowed; }
        .ht-chip { border:1px solid var(--line); border-radius:999px; padding:5px 11px; font-size:11px; white-space:nowrap; }
        .ht-chip-active { background:var(--purple); border-color:var(--purple); color:#fff; }
        .ht-fade { animation: htfade .2s ease; }
        @keyframes htfade { from{opacity:0; transform:translateY(4px);} to{opacity:1; transform:translateY(0);} }
        .ht-row-forging { position:relative; overflow:hidden; }
        .ht-row-forging::after { content:""; position:absolute; inset:0; background:linear-gradient(90deg, transparent, rgba(139,92,246,.35), rgba(45,212,232,.45), transparent); animation:ht-sweep .9s linear infinite; }
        @keyframes ht-sweep { 0%{transform:translateX(-100%);} 100%{transform:translateX(100%);} }
        .ht-scroll::-webkit-scrollbar{ display:none; }

        .ht-label {
          background:#FFFFFF; color:#14121F; border-radius:2px; border:1px solid #D9D5E8;
          padding:1.2mm 2mm; display:flex; align-items:center; gap:1.5mm;
          height:14mm; width:40mm; box-sizing:border-box; overflow:hidden; break-inside:avoid; color-scheme:light;
        }
        .ht-label-logo{ height:7.5mm; width:7.5mm; object-fit:contain; flex-shrink:0; }
        .ht-label-mid{ flex:1; min-width:0; }
        .ht-label-name-big{ font-weight:800; line-height:1.05; color:#14121F; text-transform:uppercase; letter-spacing:.01em; }
        .ht-label-sub{ font-size:6.5px; color:#6b6480; margin-top:.5mm; font-weight:500; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .ht-label-meta{ font-size:5.5px; color:#85809c; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .ht-label-price{ font-family:'JetBrains Mono', monospace; font-size:19px; font-weight:700; color:#14121F; flex-shrink:0; line-height:1; }
        .ht-label-qr{ height:9mm; width:9mm; flex-shrink:0; }

        @media print {
          .no-print{ display:none !important; }
          .ht-root{ background:white !important; color:black !important; max-width:none !important; }
          .ht-label-sheet{ display:grid !important; grid-template-columns:repeat(var(--labels-per-row,5), 40mm); gap:1.5mm; padding:4mm; }
        }
        @media (min-width: 481px) {
          .ht-root { font-size: 17px; }
          .tablet-cols-3 { grid-template-columns: repeat(3, 1fr) !important; }
          .tablet-cols-4 { grid-template-columns: repeat(4, 1fr) !important; }
          .ht-card { border-radius: 16px; }
        }
        @media (min-width: 768px) {
          .ht-root { padding-bottom: 80px; }
        }
              [data-mode="light"] {
          --void:#F4F2FB; --panel:#FFFFFF; --panel-2:#EEEAF8; --line:#D9D2EF;
          --text:#14112B; --muted:#6B5F8A; --cyan:#6B2FD4; --purple:#8B2FC4; --amber:#B45309;
          --green:#166534; --red:#991B1B;
        }
        [data-mode="light"] .ht-card { background:var(--panel); border-color:var(--line); }
        [data-mode="light"] .ht-mono { color:var(--text); }
        .ht-ticker-scroll::-webkit-scrollbar { display: none; }
        .ht-ticker-scroll { -ms-overflow-style: none; scrollbar-width: none; }
        @keyframes ticker-scroll { 0% { transform: translateX(0) } 100% { transform: translateX(-50%) } }
      `}</style>

      {/* ---- Card detail w/ price history chart (opens from any page) ---- */}
      {cardDetail && (() => {
        const r = cardDetail;
        const showRawScale = r.category === "pokemon" || r.category === "onepiece";
        const activeCondition = chartCondition || "Raw NM";
        const selectedPrice = mockLookup(r.name, r.set || "", activeCondition).price;
        const isOwnedCondition = r.condition === activeCondition;
        const rangeCfg = RANGE_OPTIONS.find(x => x.key === chartRange) || RANGE_OPTIONS[3];
        const history = generatePriceHistory(`${r.name}|${r.set || ""}|${activeCondition}|${chartRange}`, selectedPrice || 0, rangeCfg.points);
        const first = history[0], last = history[history.length - 1];
        const changePct = first ? ((last - first) / first) * 100 : 0;
        const high = Math.max(...history), low = Math.min(...history);
        const profit = (isOwnedCondition && r.costBasis != null && r.qty != null) ? (r.price - r.costBasis) * r.qty : null;
        const thirdStat = (isOwnedCondition && r.qty != null)
          ? { label: "Qty Held", value: String(r.qty) }
          : r.comps != null
            ? { label: "Comps", value: String(r.comps) }
            : { label: "Category", value: CATEGORY_LABEL[r.category] || r.category || "—" };
        return (
        <div className="ht-fade pb-2" style={{ position: "relative" }}>
          {/* ── header: back + title + actions ── */}
          <div className="px-4 pt-5 flex items-center gap-2 mb-3">
            <button onClick={() => setCardDetail(null)} style={{ flexShrink: 0 }}><ArrowLeft size={18} /></button>
            <div className="min-w-0 flex-1">
              <div className="text-base font-semibold leading-snug truncate">{r.displayName || r.name}</div>
              <div className="text-xs" style={{ color: "var(--muted)" }}>{r.set}</div>
            </div>
            <button onClick={() => toggleCardWatch(r)} className="rounded-full w-9 h-9 flex-shrink-0" style={{ display:"flex", alignItems:"center", justifyContent:"center", background: isCardWatched(r) ? "var(--cyan)" : "var(--panel-2)", border: "1px solid var(--line)" }}>
              <Bell size={15} color={isCardWatched(r) ? "#0A0912" : "var(--muted)"} />
            </button>
            <button onClick={() => shareCard({ ...r, kind: "card" })} className="rounded-full w-9 h-9 flex-shrink-0" style={{ display:"flex", alignItems:"center", justifyContent:"center", background: "var(--panel-2)", border: "1px solid var(--line)" }}>
              <Share2 size={15} color="var(--muted)" />
            </button>
          </div>

          {/* ── card image + price side by side ── */}
          <div className="px-4 flex gap-4 items-center mb-3">
            <div style={{ flexShrink: 0, width: 110 }}>
              <CardImage name={r.name} set={r.set} imageUrl={r.image || r.largeImage || null} height={155}
                style={{ borderRadius: 10, background: "var(--panel-2)" }} />
            </div>
            <div className="flex-1 min-w-0">
              {r.condition && <div className="text-xs mb-2" style={{ color: "var(--muted)" }}>Owned as {r.condition}</div>}
              <div className="ht-mono font-bold leading-none" style={{ fontSize: 34 }}>${(selectedPrice ?? 0).toFixed(2)}</div>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginTop:6 }}>
                <TrendTag pct={Math.round(changePct * 10) / 10} />
                <span className="ht-mono text-xs" style={{ color: "var(--muted)" }}>{activeCondition.startsWith("Raw ") ? activeCondition.replace("Raw ","") : activeCondition}</span>
              </div>
              <div style={{ display:"flex", gap:16, marginTop:10 }}>
                <div><div className="text-xs" style={{ color: "var(--muted)" }}>High</div><div className="ht-mono text-xs font-semibold">${high.toFixed(2)}</div></div>
                <div><div className="text-xs" style={{ color: "var(--muted)" }}>Low</div><div className="ht-mono text-xs font-semibold">${low.toFixed(2)}</div></div>
                <div><div className="text-xs" style={{ color: "var(--muted)" }}>{thirdStat.label}</div><div className="ht-mono text-xs font-semibold">{thirdStat.value}</div></div>
              </div>
              {profit !== null && (
                <div className="mt-2 text-xs" style={{ color: profit >= 0 ? "var(--green)" : "var(--red)" }}>
                  P/L {profit >= 0 ? "+" : "-"}${Math.abs(profit).toFixed(2)}
                </div>
              )}
            </div>
          </div>


          {/* ── condition selector (compact pill row) ── */}
          <div className="px-4 mt-3 flex items-center gap-2">
            {showRawScale && (
              <div className="flex rounded-full p-0.5 flex-shrink-0" style={{ background: "var(--panel-2)" }}>
                <button onClick={() => { setGradeMode("raw"); if (!activeCondition.startsWith("Raw ")) setChartCondition("Raw NM"); }} className="px-2.5 py-0.5 rounded-full text-xs font-semibold"
                  style={{ background: gradeMode === "raw" ? "var(--purple)" : "transparent", color: gradeMode === "raw" ? "#fff" : "var(--muted)" }}>Raw</button>
                <button onClick={() => { setGradeMode("graded"); if (activeCondition.startsWith("Raw ")) setChartCondition("PSA 10"); }} className="px-2.5 py-0.5 rounded-full text-xs font-semibold"
                  style={{ background: gradeMode === "graded" ? "var(--purple)" : "transparent", color: gradeMode === "graded" ? "#fff" : "var(--muted)" }}>Graded</button>
              </div>
            )}
            <div className="flex gap-1.5 overflow-x-auto ht-scroll flex-1">
              {(showRawScale && gradeMode === "raw" ? RAW_CONDITIONS : GRADED_CONDITIONS).map(c => (
                <button key={c.key} onClick={() => setChartCondition(c.key)} className={`ht-chip flex-shrink-0 ${activeCondition === c.key ? "ht-chip-active" : ""}`} style={{ padding: "3px 10px", fontSize: 11 }}>{c.label}</button>
              ))}
            </div>
          </div>

          {/* ── collapsible price chart ── */}
          <div className="px-4 mt-3">
            <button onClick={() => setChartOpen(o => !o)} className="w-full flex items-center justify-between py-1">
              <span className="text-xs font-semibold" style={{ color: "var(--muted)", letterSpacing: "0.05em" }}>PRICE CHART · {rangeCfg.label}</span>
              <ChevronDown size={14} color="var(--muted)" style={{ transform: chartOpen ? "rotate(180deg)" : "none", transition: "transform .15s" }} />
            </button>
            {chartOpen && (
              <div className="ht-fade">
                <PriceHistoryChart points={history} />
                <div className="flex gap-1.5 mt-2 overflow-x-auto ht-scroll">
                  {RANGE_OPTIONS.map(o => (
                    <button key={o.key} onClick={() => setChartRange(o.key)} className={`ht-chip flex-shrink-0 ${chartRange === o.key ? "ht-chip-active" : ""}`} style={{ padding: "3px 10px", fontSize: 11 }}>{o.label}</button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* population — always visible, grouped by company with proportion bars */}
          {(() => {
            const COMPANY_GROUPS = [
              { company: "PSA", color: "#F5A524", grades: ["PSA 10", "PSA 9", "PSA 8", "PSA 7"] },
              { company: "BGS", color: "#8B5CF6", grades: ["BGS Black Label", "BGS 10", "BGS 9.5", "BGS 9"] },
              { company: "CGC", color: "#2DD4E8", grades: ["CGC Pristine", "CGC 10", "CGC 9", "CGC 8"] },
            ];
            const allPops = COMPANY_GROUPS.flatMap(g => g.grades.map(k => getGradePopulation(r.name, r.set || "", k)));
            const maxPop = Math.max(...allPops, 1);
            const totalPop = allPops.reduce((s, n) => s + n, 0);
            return (
              <div className="px-4 mt-3">
                <div className="ht-card p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold" style={{ color: "var(--muted)", letterSpacing: "0.06em" }}>POPULATION BY GRADE</span>
                    <span className="ht-mono text-xs" style={{ color: "var(--muted)" }}>{totalPop.toLocaleString()} total slabs</span>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    {COMPANY_GROUPS.map(({ company, color, grades }) => (
                      <div key={company}>
                        <div className="flex items-center gap-1.5 mb-2">
                          <span className="w-2 h-2 rounded-full inline-block" style={{ background: color }} />
                          <span className="text-xs font-bold">{company}</span>
                        </div>
                        <div className="flex flex-col gap-2">
                          {grades.map(g => {
                            const pop = getGradePopulation(r.name, r.set || "", g);
                            const isActive = activeCondition === g;
                            return (
                              <div key={g} onClick={() => { setChartCondition(g); setGradeMode("graded"); }} style={{ cursor: "pointer" }}>
                                <div className="flex items-center justify-between mb-0.5">
                                  <span className="text-xs" style={{ color: isActive ? color : "var(--muted)", fontWeight: isActive ? 700 : 400 }}>{g.replace(`${company} `, "").replace("Black Label", "BL")}</span>
                                  <span className="ht-mono text-xs font-semibold" style={{ color: isActive ? color : "var(--text)" }}>{pop.toLocaleString()}</span>
                                </div>
                                <div className="rounded-full overflow-hidden" style={{ height: 3, background: "var(--panel-2)" }}>
                                  <div style={{ width: `${Math.max(6, Math.round((pop / maxPop) * 100))}%`, height: "100%", background: color, opacity: isActive ? 1 : 0.45, transition: "opacity .15s" }} />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs mt-3" style={{ color: "var(--muted)" }}>Tap a grade to see its price chart. Bars show relative scarcity.</p>
                </div>
              </div>
            );
          })()}

          <div className="px-4 mt-2">
            {detailAddConfirm && (
              <div className="ht-card p-2.5 mb-2 text-center text-xs font-semibold ht-fade" style={{ color: "var(--green)", borderColor: "var(--green)" }}>
                {detailAddConfirm}
              </div>
            )}
            <button onClick={() => setCardAddPickerOpen(o => !o)} className="ht-btn-primary rounded-lg py-2.5 text-sm font-semibold w-full flex items-center justify-center gap-2">
              <Layers size={15} /> Add to Portfolio
            </button>
            {cardAddPickerOpen && (
              <div className="mt-2 ht-fade">
                {portfolios.map(p => (
                  <button key={p.id} onClick={() => addCardDetailToPortfolio(p.id)}
                    className="w-full text-left text-xs px-3 py-2.5 rounded-md mb-1.5 flex items-center gap-2" style={{ background: "var(--panel-2)" }}>
                    <div style={{ width: 6, height: 6, borderRadius: 999, background: p.accent }} /> {p.name}
                  </button>
                ))}
                {portfolios.length === 0 && <p className="text-xs" style={{ color: "var(--muted)" }}>No portfolios yet — create one from the Portfolio tab first.</p>}
              </div>
            )}
          </div>

          <p className="px-4 mt-4 pb-6 text-xs" style={{ color: "var(--muted)" }}>Price history is simulated for demo purposes — a production build would pull this from Card Ladder's or PriceCharting's historical sales API.</p>
        </div>
        );
      })()}

      {/* ---- Sealed product detail w/ price history chart (opens from any page) ---- */}
      {!cardDetail && sealedDetail && (() => {
        const p = sealedDetail;
        const rangeCfg = RANGE_OPTIONS.find(x => x.key === chartRange) || RANGE_OPTIONS[3];
        const history = generatePriceHistory(`${p.productName}|${p.category || ""}|${chartRange}`, p.marketEach || 0, rangeCfg.points);
        const first = history[0], last = history[history.length - 1];
        const changePct = first ? ((last - first) / first) * 100 : 0;
        const high = Math.max(...history), low = Math.min(...history);
        const profit = (p.qty != null && p.costEach != null) ? (p.marketEach - p.costEach) * p.qty : null;
        const thirdStat = p.qty != null
          ? { label: "Units Held", value: String(p.qty) }
          : { label: "Category", value: CATEGORY_LABEL[p.category] || p.category || "—" };
        return (
        <div className="ht-fade">
          <div className="px-4 pt-6 pb-3 flex items-center gap-3">
            <button onClick={() => setSealedDetail(null)}><ArrowLeft size={18} /></button>
            <div className="min-w-0 flex-1">
              <h1 className="text-lg font-semibold truncate">{p.productName}</h1>
              <div className="text-xs" style={{ color: "var(--muted)" }}>{CATEGORY_LABEL[p.category] || p.category}</div>
            </div>
            <button onClick={() => toggleSealedWatch(p)} className="rounded-full w-9 h-9 flex items-center justify-center flex-shrink-0" style={{ background: isSealedWatched(p) ? "var(--cyan)" : "var(--panel-2)", border: "1px solid var(--line)" }}>
              <Bell size={16} color={isSealedWatched(p) ? "#0A0912" : "var(--muted)"} />
            </button>
            <button onClick={() => shareCard({ ...p, kind: "sealed" })} className="rounded-full w-9 h-9 flex items-center justify-center flex-shrink-0" style={{ background: "var(--panel-2)", border: "1px solid var(--line)" }}>
              <Share2 size={16} color="var(--muted)" />
            </button>
          </div>

          <div className="px-4 mt-1 mb-1">
            <CardImage sealedName={p.productName} height={140} style={{ borderRadius: 12, background: "radial-gradient(circle at 50% 50%, var(--panel-2), var(--panel))" }} />
          </div>

          <div className="px-4">
            <div className="ht-mono text-4xl font-bold leading-none">${(p.marketEach ?? 0).toFixed(2)}</div>
            <div className="flex items-center gap-2 mt-2">
              <TrendTag pct={Math.round(changePct * 10) / 10} />
              <span className="text-xs" style={{ color: "var(--muted)" }}>over {rangeCfg.label}</span>
            </div>
          </div>

          <div className="px-4 mt-4">
            <PriceHistoryChart points={history} />
          </div>

          <div className="px-4 flex gap-2 mt-3 overflow-x-auto ht-scroll">
            {RANGE_OPTIONS.map(o => (
              <button key={o.key} onClick={() => setChartRange(o.key)} className={`ht-chip flex-shrink-0 ${chartRange === o.key ? "ht-chip-active" : ""}`}>{o.label}</button>
            ))}
          </div>

          <div className="px-4 mt-4">
            {detailAddConfirm && (
              <div className="ht-card p-2.5 mb-2 text-center text-xs font-semibold ht-fade" style={{ color: "var(--green)", borderColor: "var(--green)" }}>
                {detailAddConfirm}
              </div>
            )}
            <button onClick={() => setSealedAddPickerOpen(o => !o)} className="ht-btn-primary rounded-lg py-2.5 text-sm font-semibold w-full flex items-center justify-center gap-2">
              <Layers size={15} /> Add to Portfolio
            </button>
            {sealedAddPickerOpen && (
              <div className="mt-2 ht-fade">
                {sealedPortfolios.map(sp => (
                  <button key={sp.id} onClick={() => addSealedDetailToPortfolio(sp.id)}
                    className="w-full text-left text-xs px-3 py-2.5 rounded-md mb-1.5 flex items-center gap-2" style={{ background: "var(--panel-2)" }}>
                    <div style={{ width: 6, height: 6, borderRadius: 999, background: sp.accent }} /> {sp.name}
                  </button>
                ))}
                {sealedPortfolios.length === 0 && <p className="text-xs" style={{ color: "var(--muted)" }}>No sealed portfolios yet — create one from the Portfolio tab first.</p>}
              </div>
            )}
          </div>

          <div className="px-4 grid grid-cols-3 gap-2 mt-4">
            <div className="ht-card p-3 text-center">
              <div className="text-xs" style={{ color: "var(--muted)" }}>High</div>
              <div className="ht-mono text-sm font-semibold mt-1">${high.toFixed(2)}</div>
            </div>
            <div className="ht-card p-3 text-center">
              <div className="text-xs" style={{ color: "var(--muted)" }}>Low</div>
              <div className="ht-mono text-sm font-semibold mt-1">${low.toFixed(2)}</div>
            </div>
            <div className="ht-card p-3 text-center">
              <div className="text-xs" style={{ color: "var(--muted)" }}>{thirdStat.label}</div>
              <div className="ht-mono text-sm font-semibold mt-1">{thirdStat.value}</div>
            </div>
          </div>

          {profit !== null && (
            <div className="px-4 mt-3">
              <div className="ht-card p-3 flex items-center justify-between">
                <span className="text-xs" style={{ color: "var(--muted)" }}>Cost ${p.costEach.toFixed(2)} ea · Unrealized P/L</span>
                <span className="ht-mono text-sm font-semibold" style={{ color: profit >= 0 ? "var(--green)" : "var(--red)" }}>
                  {profit >= 0 ? "+" : "-"}${Math.abs(profit).toFixed(2)}
                </span>
              </div>
            </div>
          )}

          <p className="px-4 mt-4 pb-6 text-xs" style={{ color: "var(--muted)" }}>Price history is simulated for demo purposes — a production build would pull this from TCGplayer's or eBay's historical sealed-product comps.</p>
        </div>
        );
      })()}

      {!cardDetail && !sealedDetail && (<>

      {/* ============ TICKER ============ */}
      {!tickerHidden && (
        <div className="no-print" style={{ position: "sticky", top: 0, zIndex: 20, background: "rgba(10,9,18,0.92)", backdropFilter: "blur(8px)", borderBottom: "1px solid var(--line)", height: 36, overflow: "hidden" }}>
          <div className="flex items-center" style={{ overflow: "hidden", height: "100%" }}>
            <div style={{ flex: 1, overflow: "hidden", minWidth: 0, height: "100%" }}>
              <div className="ht-ticker-inner flex items-center gap-5 py-2 pl-3"
                style={{ width: "max-content", animation: "ticker-scroll 45s linear infinite", willChange: "transform", transform: "translateZ(0)" }}
                onMouseEnter={(e) => e.currentTarget.style.animationPlayState = "paused"}
                onMouseLeave={(e) => e.currentTarget.style.animationPlayState = "running"}
                onTouchStart={(e) => e.currentTarget.style.animationPlayState = "paused"}
                onTouchEnd={(e) => e.currentTarget.style.animationPlayState = "running"}>
                {/* render items twice so loop is seamless — gainers first, then losers */}
                {(() => {
                  const gainers = [...MARKET_MOVERS].sort((a, b) => b.changePct - a.changePct).filter(r => r.changePct >= 0).slice(0, 5);
                  const losers = [...MARKET_MOVERS].sort((a, b) => a.changePct - b.changePct).filter(r => r.changePct < 0).slice(0, 5);
                  const count = Math.min(gainers.length, losers.length);
                  // interleave: G, L, G, L ...
                  const items = [];
                  for (let i = 0; i < count; i++) {
                    items.push({ ...gainers[i], _tickerKind: "gainer" });
                    items.push({ ...losers[i], _tickerKind: "loser" });
                  }
                  return [0, 1].map(rep => (
                    <div key={rep} className="flex items-center gap-4">
                      {items.map((r, i) => (
                        <div key={`${rep}-${i}`} className="flex items-center gap-3">
                          <div onClick={() => openCardDetail(r)} className="flex items-center gap-2 flex-shrink-0" style={{ cursor: "pointer" }}>
                            <CatDot category={r.category} />
                            <span className="text-xs font-semibold" style={{ whiteSpace: "nowrap" }}>{r.name.length > 16 ? r.name.slice(0, 15) + "…" : r.name}</span>
                            <span className="ht-mono text-xs font-bold" style={{ whiteSpace: "nowrap", color: "var(--text)" }}>${r.price.toFixed(2)}</span>
                            <span className="ht-mono text-xs font-bold" style={{ color: r._tickerKind === "gainer" ? "var(--green)" : "var(--red)", whiteSpace: "nowrap" }}>
                              {r._tickerKind === "gainer" ? "▲" : "▼"}{Math.abs(r.changePct)}%
                            </span>
                          </div>
                          <span style={{ width: 1, height: 16, background: "var(--line)", flexShrink: 0 }} />
                        </div>
                      ))}
                    </div>
                  ));
                })()}
              </div>
            </div>
            <button onClick={() => setTickerHidden(true)} className="flex-shrink-0 flex items-center justify-center px-2 py-2" style={{ borderLeft: "1px solid var(--line)" }} title="Hide ticker">
              <ChevronRight size={14} color="var(--muted)" style={{ transform: "rotate(-90deg)" }} />
            </button>
          </div>
        </div>
      )}
      {tickerHidden && (
        <button onClick={() => setTickerHidden(false)} className="no-print" style={{ position: "sticky", top: 0, zIndex: 20, width: "100%", background: "rgba(10,9,18,0.92)", backdropFilter: "blur(8px)", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "center", gap: 4, padding: "3px 0", cursor: "pointer" }}>
          <span className="text-xs" style={{ color: "var(--muted)" }}>Trending</span>
          <ChevronRight size={12} color="var(--muted)" style={{ transform: "rotate(90deg)" }} />
        </button>
      )}

      {/* ============ HOME ============ */}
      {tab === "home" && (
        <div className="ht-fade">
          <div className="px-4 pt-6 pb-1 flex items-center justify-between">
            <div>
              <p className="text-xs" style={{ color: "var(--muted)" }}>Welcome back, {profileName}</p>
              <h1 className="text-lg font-semibold mt-0.5">Your Portfolio</h1>
            </div>
            <button onClick={() => setTab("profile")} className="rounded-full flex-shrink-0 overflow-hidden" style={{ width: 36, height: 36, background: "var(--panel-2)", border: "2px solid var(--line)" }}>
              {profileAvatar
                ? <img src={profileAvatar} alt="avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}><User size={16} color="var(--muted)" /></div>
              }
            </button>
          </div>

          {/* hero value card */}
          <div className="mx-4 mt-3 rounded-2xl p-5 relative overflow-hidden" style={{ background: "linear-gradient(145deg, rgba(139,92,246,0.16), rgba(45,212,232,0.06))", border: "1px solid var(--line)" }}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs" style={{ color: "var(--muted)" }}>Total Portfolio Value</p>
                <div className="ht-mono text-4xl font-bold mt-1 leading-none">${grandTotalValue.toFixed(2)}</div>
                <div className="flex items-center gap-2 mt-2.5">
                  <TrendTag pct={Math.round(grandAvgTrend * 10) / 10} />
                  <span className="text-xs" style={{ color: "var(--muted)" }}>
                    {grandDollarChange >= 0 ? "+" : "-"}${Math.abs(grandDollarChange).toFixed(2)} today
                  </span>
                </div>
                <div className="text-xs mt-1.5" style={{ color: "var(--muted)" }}>
                  Cards <span className="ht-mono" style={{ color: "var(--text)" }}>${totalValue.toFixed(2)}</span> · Sealed <span className="ht-mono" style={{ color: "var(--text)" }}>${sealedTotalValue.toFixed(2)}</span>
                </div>
              </div>
              <Sparkline seed={grandTotalValue.toFixed(0)} positive={grandAvgTrend >= 0} />
            </div>
            <div className="flex items-center gap-3 mt-4 pt-3" style={{ borderTop: "1px solid var(--line)" }}>
              <div>
                <div className="ht-mono text-sm font-semibold">{portfolios.length + sealedPortfolios.length}</div>
                <div className="text-xs" style={{ color: "var(--muted)" }}>Portfolios</div>
              </div>
              <div style={{ width: 1, height: 24, background: "var(--line)" }} />
              <div>
                <div className="ht-mono text-sm font-semibold">{allRows.length + sealedInventory.reduce((s, i) => s + i.qty, 0)}</div>
                <div className="text-xs" style={{ color: "var(--muted)" }}>Items Tracked</div>
              </div>
              <div style={{ width: 1, height: 24, background: "var(--line)" }} />
              <div>
                <div className="ht-mono text-sm font-semibold" style={{ color: grandTotalProfit >= 0 ? "var(--green)" : "var(--red)" }}>
                  {grandTotalProfit >= 0 ? "+" : "-"}${Math.abs(grandTotalProfit).toFixed(2)}
                </div>
                <div className="text-xs" style={{ color: "var(--muted)" }}>Profit</div>
              </div>
            </div>
          </div>

          {/* quick actions */}
          <div className="px-4 grid grid-cols-4 gap-2 mt-4">
            <button onClick={() => setTab("portfolio")} className="ht-btn-primary rounded-xl py-3" style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:4 }}>
              <Tag size={16} /><span style={{ fontSize:12, fontWeight:600 }}>Price</span>
            </button>
            <button onClick={() => setTab("search")} className="ht-input rounded-xl py-3" style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:4 }}>
              <Search size={16} /><span style={{ fontSize:12, fontWeight:600 }}>Search</span>
            </button>
            <button onClick={() => { setTab("tools"); setToolsView("calculator"); }} className="ht-input rounded-xl py-3" style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:4 }}>
              <CalcIcon size={16} /><span style={{ fontSize:12, fontWeight:600 }}>Calc</span>
            </button>
            <button onClick={() => { setTab("portfolio"); if (!isPro && portfolios.length >= FREE_LIMITS.cardPortfolios) { gate("Unlimited portfolios"); return; } setNewPortfolioOpen(true); }} className="ht-input rounded-xl py-3" style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:4 }}>
              <Plus size={16} /><span style={{ fontSize:12, fontWeight:600 }}>New</span>
            </button>
          </div>

          {/* watchlist alerts — only shows when something actually hit its target */}
          {watchlistWithPrices.some(w => w.triggered) && (
            <button onClick={() => setTab("watchlist")} className="mx-4 mt-3 rounded-xl p-3 flex items-center gap-3 w-[calc(100%-2rem)] text-left ht-fade" style={{ background: "rgba(52,211,153,0.12)", border: "1px solid var(--green)" }}>
              <div className="rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0" style={{ background: "var(--green)" }}><Bell size={14} color="#0A0912" /></div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold" style={{ color: "var(--green)" }}>
                  {watchlistWithPrices.filter(w => w.triggered).length} item{watchlistWithPrices.filter(w => w.triggered).length === 1 ? "" : "s"} hit your target price
                </div>
                <div className="text-xs truncate" style={{ color: "var(--muted)" }}>{watchlistWithPrices.filter(w => w.triggered).map(w => w.name).join(", ")}</div>
              </div>
              <ChevronRight size={16} color="var(--green)" className="flex-shrink-0" />
            </button>
          )}

          {/* quick tools — user-picked shortcuts */}
          <div className="flex items-center justify-between px-4 mt-5 mb-2">
            <h2 className="text-sm font-semibold">Quick Tools</h2>
            <button onClick={() => setQuickToolsEditOpen(o => !o)} className={`ht-chip ${quickToolsEditOpen ? "ht-chip-active" : ""}`}>{quickToolsEditOpen ? "Done" : "Edit"}</button>
          </div>
          {quickToolsEditOpen ? (
            <div className="px-4 mb-2 ht-fade">
              <p className="text-xs mb-2" style={{ color: "var(--muted)" }}>Pick up to 8 tools to pin here.</p>
              <div className="flex gap-2 flex-wrap">
                {Object.entries(TOOL_META).map(([key, meta]) => (
                  <button key={key} onClick={() => toggleQuickTool(key)} className={`ht-chip ${quickTools.includes(key) ? "ht-chip-active" : ""}`}>{meta.label}</button>
                ))}
              </div>
            </div>
          ) : (
            <div className="px-4 grid grid-cols-4 gap-2 mb-1">
              {quickTools.map(key => {
                const meta = TOOL_META[key];
                if (!meta) return null;
                const Icon = meta.icon;
                return (
                  <button key={key} onClick={() => { if (PRO_TOOLS.includes(key) && !gate(meta.label)) return; setTab("tools"); setToolsView(key); }} className="ht-card p-2.5 text-center" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6 }}>
                    <Icon size={17} color={meta.color} />
                    <span className="text-xs font-semibold leading-tight" style={{ fontSize: 10 }}>{meta.label.split(" / ")[0].split(" & ")[0]}</span>
                  </button>
                );
              })}
              {quickTools.length === 0 && <p className="text-xs col-span-4" style={{ color: "var(--muted)" }}>No tools pinned — tap Edit to add your favorites.</p>}
            </div>
          )}

          {/* pro upsell — free users only */}
          {!isPro && (
            <div className="px-4 mt-5">
              <button onClick={() => { setPaywallTrigger(""); setPaywallOpen(true); }} className="w-full text-left rounded-2xl p-4 relative overflow-hidden" style={{ background: "linear-gradient(135deg, rgba(139,92,246,0.32), rgba(45,212,232,0.14))", border: "1px solid var(--purple)" }}>
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <div className="ht-display text-xl leading-none" style={{ background: "linear-gradient(90deg, var(--purple), var(--cyan))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>GO PRO — FREE FOR 7 DAYS</div>
                    <div className="text-xs mt-1.5 leading-snug" style={{ color: "var(--text)" }}>POS register, Kiosk Mode, AI grading, label printing &amp; cross-listing. Built for show weekends.</div>
                    <div className="text-xs mt-1" style={{ color: "var(--muted)" }}>$9.99/mo after · cancel anytime · one flip covers it</div>
                  </div>
                  <span className="ht-mono text-xs font-bold px-2.5 py-1.5 rounded-lg flex-shrink-0 ml-3" style={{ background: "linear-gradient(90deg, var(--purple), var(--cyan))", color: "#0A0912" }}>TRY FREE</span>
                </div>
              </button>
            </div>
          )}

          {/* market trends — unified cards/sealed section */}
          <div className="flex items-center justify-between px-4 mt-5 mb-2">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold">Market Trends</h2>
              <div className="flex rounded-full p-0.5" style={{ background: "var(--panel-2)" }}>
                <button onClick={() => setHomeTrendSection("cards")} className="px-2.5 py-0.5 rounded-full text-xs font-semibold"
                  style={{ background: homeTrendSection === "cards" ? "var(--purple)" : "transparent", color: homeTrendSection === "cards" ? "#fff" : "var(--muted)" }}>
                  Cards
                </button>
                <button onClick={() => setHomeTrendSection("sealed")} className="px-2.5 py-0.5 rounded-full text-xs font-semibold"
                  style={{ background: homeTrendSection === "sealed" ? "var(--purple)" : "transparent", color: homeTrendSection === "sealed" ? "#fff" : "var(--muted)" }}>
                  Sealed
                </button>
              </div>
            </div>
            <div className="flex rounded-full p-0.5" style={{ background: "var(--panel-2)" }}>
              <button onClick={() => setHomeMoverTab("gainers")} className="px-2.5 py-0.5 rounded-full text-xs font-semibold"
                style={{ background: homeMoverTab === "gainers" ? "var(--green)" : "transparent", color: homeMoverTab === "gainers" ? "#0A0912" : "var(--muted)" }}>
                ▲
              </button>
              <button onClick={() => setHomeMoverTab("losers")} className="px-2.5 py-0.5 rounded-full text-xs font-semibold"
                style={{ background: homeMoverTab === "losers" ? "var(--red)" : "transparent", color: homeMoverTab === "losers" ? "#0A0912" : "var(--muted)" }}>
                ▼
              </button>
            </div>
          </div>
          <div className="px-4 flex gap-2 mb-2 overflow-x-auto ht-scroll">
            <button onClick={() => setHomeCategory("all")} className={`ht-chip flex-shrink-0 ${homeCategory === "all" ? "ht-chip-active" : ""}`}>All</button>
            {CATEGORIES.map(c => (
              <button key={c.key} onClick={() => setHomeCategory(c.key)} className={`ht-chip flex-shrink-0 ${homeCategory === c.key ? "ht-chip-active" : ""}`}>{c.label}</button>
            ))}
          </div>

          <div className="px-4 flex flex-col gap-2 mb-2">
            {homeTrendSection === "cards" && (() => {
              const filtered = homeCategory === "all" ? MARKET_MOVERS : MARKET_MOVERS.filter(r => r.category === homeCategory);
              const list = homeMoverTab === "gainers"
                ? [...filtered].sort((a, b) => b.changePct - a.changePct)
                : [...filtered].sort((a, b) => a.changePct - b.changePct);
              if (list.length === 0) return <p className="text-xs" style={{ color: "var(--muted)" }}>Nothing in this category yet.</p>;
              return list.slice(0, 5).map((r, i) => (
                <div key={`${r.name}-${r.set}`} className="ht-card p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2.5 min-w-0" onClick={() => openCardDetail(r)} style={{ cursor: "pointer" }}>
                    <span className="ht-mono text-xs font-semibold flex-shrink-0" style={{ color: "var(--muted)", width: 14 }}>{i + 1}</span>
                    <CatDot category={r.category} />
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{r.name}</div>
                      <div className="text-xs truncate" style={{ color: "var(--muted)" }}>{r.set}</div>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0 ml-2 flex items-center gap-1.5">
                    <div>
                      <div className="ht-mono text-sm font-semibold">${r.price.toFixed(2)}</div>
                      <TrendTag pct={r.changePct} />
                    </div>
                    <button onClick={() => toggleCardWatch(r)} className="rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0" style={{ background: isCardWatched(r) ? "var(--cyan)" : "var(--panel-2)", border: "1px solid var(--line)" }} title="Add to watchlist">
                      <Bell size={11} color={isCardWatched(r) ? "#0A0912" : "var(--muted)"} />
                    </button>
                  </div>
                </div>
              ));
            })()}

            {homeTrendSection === "sealed" && (() => {
              const filtered = homeCategory === "all" ? SEALED_TRENDING : SEALED_TRENDING.filter(t => t.category === homeCategory);
              const list = homeMoverTab === "gainers"
                ? [...filtered].sort((a, b) => b.changePct - a.changePct)
                : [...filtered].sort((a, b) => a.changePct - b.changePct);
              if (list.length === 0) return <p className="text-xs" style={{ color: "var(--muted)" }}>Nothing in this category yet.</p>;
              return list.slice(0, 5).map((t, i) => (
                <div key={t.productName} className="ht-card p-3 flex items-center gap-3">
                  <div className="flex items-center gap-2.5 min-w-0 flex-1" onClick={() => openSealedDetail({ productName: t.productName, category: t.category, marketEach: t.price })} style={{ cursor: "pointer" }}>
                    <span className="ht-mono text-xs font-semibold flex-shrink-0" style={{ color: "var(--muted)", width: 14 }}>{i + 1}</span>
                    <CatDot category={t.category} />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">{t.productName}</div>
                      <div className="text-xs" style={{ color: "var(--muted)" }}>Sealed</div>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="ht-mono text-sm font-semibold">${t.price.toFixed(2)}</div>
                    <TrendTag pct={t.changePct} />
                  </div>
                  <button onClick={() => toggleSealedWatch({ productName: t.productName, category: t.category, marketEach: t.price })}
                    className="rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0" style={{ background: isSealedWatched({ productName: t.productName }) ? "var(--cyan)" : "var(--panel-2)", border: "1px solid var(--line)" }} title="Add to watchlist">
                    <Bell size={11} color={isSealedWatched({ productName: t.productName }) ? "#0A0912" : "var(--muted)"} />
                  </button>
                </div>
              ));
            })()}
          </div>
          <div className="px-4 mb-6">
            <button onClick={() => setTab("explore")} className="w-full text-center text-xs font-semibold py-2" style={{ color: "var(--cyan)" }}>
              See all trends in Explore →
            </button>
          </div>
        </div>
      )}

      {/* ============ PORTFOLIO ============ */}

      {/* ---- All Portfolios: whole collection in one list ---- */}
      {tab === "portfolio" && allItemsOpen && !activePortfolio && !activeSealedPortfolio && (() => {
        const cardItems = allRows.map(r => ({ kind: "card", key: `c-${r.id}`, data: r }));
        const sealedItems = sealedPortfolios.flatMap(sp => sp.items.map(i => ({ kind: "sealed", key: `s-${i.id}`, data: { ...i, portfolioName: sp.name } })));
        let items = allItemsFilter === "cards" ? cardItems : allItemsFilter === "sealed" ? sealedItems : [...cardItems, ...sealedItems];
        const q = allItemsSearch.trim().toLowerCase();
        if (q) {
          items = items.filter(it => it.kind === "card"
            ? (it.data.name.toLowerCase().includes(q) || (it.data.set || "").toLowerCase().includes(q) || (it.data.condition || "").toLowerCase().includes(q) || (it.data.portfolioName || "").toLowerCase().includes(q))
            : (it.data.productName.toLowerCase().includes(q) || (it.data.portfolioName || "").toLowerCase().includes(q)));
        }
        const itemValue = (it) => it.kind === "card" ? (it.data.price || 0) * it.data.qty : it.data.marketEach * it.data.qty;
        const itemUnitPrice = (it) => it.kind === "card" ? (it.data.price || 0) : it.data.marketEach;
        const itemName = (it) => it.kind === "card" ? it.data.name : it.data.productName;
        const itemPct = (it) => it.kind === "card" ? (it.data.trendPct || 0) : sealedItemTrendPct(it.data.productName);
        const itemAddedTs = (it) => { const n = parseInt(String(it.data.id || "").replace(/\D/g, ""), 10); return Number.isFinite(n) ? n : 0; };
        const SORTERS = {
          value: (a, b) => itemValue(b) - itemValue(a),
          priceLow: (a, b) => itemUnitPrice(a) - itemUnitPrice(b),
          priceHigh: (a, b) => itemUnitPrice(b) - itemUnitPrice(a),
          nameAZ: (a, b) => itemName(a).localeCompare(itemName(b)),
          nameZA: (a, b) => itemName(b).localeCompare(itemName(a)),
          pctLow: (a, b) => itemPct(a) - itemPct(b),
          pctHigh: (a, b) => itemPct(b) - itemPct(a),
          dateNew: (a, b) => itemAddedTs(b) - itemAddedTs(a),
          dateOld: (a, b) => itemAddedTs(a) - itemAddedTs(b),
        };
        items = [...items].sort(SORTERS[allItemsSort] || SORTERS.value);
        const shownValue = items.reduce((s, it) => s + itemValue(it), 0);
        return (
        <div className="ht-fade">
          <div className="px-4 pt-6 pb-3 flex items-center gap-3">
            <button onClick={() => setAllItemsOpen(false)}><ArrowLeft size={18} /></button>
            <div className="min-w-0 flex-1">
              <h1 className="text-lg font-semibold">All Portfolios</h1>
              <div className="text-xs" style={{ color: "var(--muted)" }}>{items.length} item{items.length === 1 ? "" : "s"} · <span className="ht-mono">${shownValue.toFixed(2)}</span></div>
            </div>
          </div>

          {/* collection value over time */}
          {(() => {
            const rangeCfg = RANGE_OPTIONS.find(x => x.key === allItemsChartRange) || RANGE_OPTIONS[3];
            const history = generatePriceHistory(`collection|${allItemsChartRange}`, grandTotalValue || 0, rangeCfg.points);
            const first = history[0], last = history[history.length - 1];
            const changePct = first ? ((last - first) / first) * 100 : 0;
            const changeDollar = last - first;
            return (
              <div className="px-4 mb-3">
                <div className="ht-card p-4">
                  <div className="text-xs" style={{ color: "var(--muted)" }}>Collection Value</div>
                  <div className="ht-mono text-2xl font-bold mt-0.5">${grandTotalValue.toFixed(2)}</div>
                  <div className="flex items-center gap-2 mt-1.5">
                    <TrendTag pct={Math.round(changePct * 10) / 10} />
                    <span className="text-xs" style={{ color: "var(--muted)" }}>
                      {changeDollar >= 0 ? "+" : "-"}${Math.abs(changeDollar).toFixed(2)} over {rangeCfg.label}
                    </span>
                  </div>
                  <div className="mt-3">
                    <PriceHistoryChart points={history} />
                  </div>
                  <div className="flex gap-2 mt-3 overflow-x-auto ht-scroll">
                    {RANGE_OPTIONS.map(o => (
                      <button key={o.key} onClick={() => setAllItemsChartRange(o.key)} className={`ht-chip flex-shrink-0 ${allItemsChartRange === o.key ? "ht-chip-active" : ""}`}>{o.label}</button>
                    ))}
                  </div>
                </div>
              </div>
            );
          })()}

          <div className="px-4 mb-2">
            <input value={allItemsSearch} onChange={(e) => setAllItemsSearch(e.target.value)}
              placeholder="Search your collection..." className="ht-input rounded-lg px-3 py-2.5 text-sm w-full" />
          </div>

          <div className="px-4 flex items-center gap-2 mb-3">
            <div className="flex gap-2">
              {[["all", "All"], ["cards", "Cards"], ["sealed", "Sealed"]].map(([k, label]) => (
                <button key={k} onClick={() => setAllItemsFilter(k)} className={`ht-chip ${allItemsFilter === k ? "ht-chip-active" : ""}`}>{label}</button>
              ))}
            </div>
            <select value={allItemsSort} onChange={(e) => setAllItemsSort(e.target.value)} className="ht-input rounded-md px-2 py-1.5 text-xs ml-auto">
              <option value="value" style={{ background: "var(--panel-2)" }}>Sort: Highest Value</option>
              <option value="priceLow" style={{ background: "var(--panel-2)" }}>Price: Low to High</option>
              <option value="priceHigh" style={{ background: "var(--panel-2)" }}>Price: High to Low</option>
              <option value="pctLow" style={{ background: "var(--panel-2)" }}>Percent Change: Low to High</option>
              <option value="pctHigh" style={{ background: "var(--panel-2)" }}>Percent Change: High to Low</option>
              <option value="nameAZ" style={{ background: "var(--panel-2)" }}>Name: A to Z</option>
              <option value="nameZA" style={{ background: "var(--panel-2)" }}>Name: Z to A</option>
              <option value="dateNew" style={{ background: "var(--panel-2)" }}>Date Added: Newest First</option>
              <option value="dateOld" style={{ background: "var(--panel-2)" }}>Date Added: Oldest First</option>
            </select>
          </div>

          <div className="px-4 flex flex-col gap-2 pb-6">
            {items.map(it => it.kind === "card" ? (
              <div key={it.key} onClick={() => openCardDetail(it.data)} className="ht-card p-3 flex items-center gap-3" style={{ cursor: "pointer" }}>
                <CatDot category={it.data.category} />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{it.data.name}</div>
                  <div className="text-xs truncate" style={{ color: "var(--muted)" }}>{it.data.condition} · qty {it.data.qty} · {it.data.portfolioName}</div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="ht-mono text-sm font-semibold">${((it.data.price || 0) * it.data.qty).toFixed(2)}</div>
                  <TrendTag pct={it.data.trendPct || 0} />
                </div>
                <button onClick={(e) => { e.stopPropagation(); toggleCardWatch(it.data); }} className="rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0" style={{ background: isCardWatched(it.data) ? "var(--cyan)" : "var(--panel-2)", border: "1px solid var(--line)" }}>
                  <Bell size={11} color={isCardWatched(it.data) ? "#0A0912" : "var(--muted)"} />
                </button>
              </div>
            ) : (
              <div key={it.key} onClick={() => openSealedDetail(it.data)} className="ht-card p-3 flex items-center gap-3" style={{ cursor: "pointer" }}>
                <CatDot category={it.data.category} />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{it.data.productName}</div>
                  <div className="text-xs truncate" style={{ color: "var(--muted)" }}>Sealed · {it.data.qty} unit{it.data.qty === 1 ? "" : "s"} · {it.data.portfolioName}</div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="ht-mono text-sm font-semibold">${(it.data.marketEach * it.data.qty).toFixed(2)}</div>
                  <TrendTag pct={sealedItemTrendPct(it.data.productName)} />
                </div>
                <button onClick={(e) => { e.stopPropagation(); toggleSealedWatch(it.data); }} className="rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0" style={{ background: isSealedWatched(it.data) ? "var(--cyan)" : "var(--panel-2)", border: "1px solid var(--line)" }}>
                  <Bell size={11} color={isSealedWatched(it.data) ? "#0A0912" : "var(--muted)"} />
                </button>
              </div>
            ))}
            {items.length === 0 && <p className="text-xs text-center py-8" style={{ color: "var(--muted)" }}>Nothing here yet.</p>}
          </div>
        </div>
        );
      })()}
      {tab === "portfolio" && !allItemsOpen && !activePortfolio && !activeSealedPortfolio && (() => {
        const sealedValue = sealedInventory.reduce((s, p) => s + p.marketEach * p.qty, 0);
        const sealedCost = sealedInventory.reduce((s, p) => s + p.costEach * p.qty, 0);
        const overallValue = totalValue + sealedValue;
        return (
        <div className="ht-fade">
          <div className="px-4 pt-6 pb-3 flex items-center justify-between">
            <h1 className="ht-display text-3xl leading-none">PORTFOLIOS</h1>
            <div className="flex items-center gap-2">
              <button onClick={() => { setPortfolioListSearchOpen(o => !o); setPortfolioListSearch(""); }} className="rounded-full w-9 h-9 flex items-center justify-center" style={{ background: portfolioListSearchOpen ? "var(--cyan)" : "var(--panel-2)", border: "1px solid var(--line)" }} title="Search your portfolios">
                <Search size={16} color={portfolioListSearchOpen ? "#0A0912" : "var(--muted)"} />
              </button>
              <button onClick={() => {
                if (portfolioSection === "cards") {
                  if (!isPro && portfolios.length >= FREE_LIMITS.cardPortfolios) { gate("Unlimited portfolios"); return; }
                  setNewPortfolioOpen(true);
                } else {
                  if (!isPro && sealedPortfolios.length >= FREE_LIMITS.sealedPortfolios) { gate("Unlimited portfolios"); return; }
                  setNewSealedPortfolioOpen(true);
                }
              }} className="ht-btn-primary rounded-full w-9 h-9 flex items-center justify-center"><Plus size={17} /></button>
            </div>
          </div>

          {/* overall inventory value */}
          <div className="mx-4 rounded-2xl p-5 mb-4 relative overflow-hidden" style={{ background: "linear-gradient(145deg, rgba(139,92,246,0.16), rgba(45,212,232,0.06))", border: "1px solid var(--line)" }}>
            <p className="text-xs" style={{ color: "var(--muted)" }}>Total Inventory Value</p>
            <div className="ht-mono text-4xl font-bold mt-1 leading-none">${overallValue.toFixed(2)}</div>
            <div className="flex items-center gap-3 mt-4 pt-3" style={{ borderTop: "1px solid var(--line)" }}>
              <div>
                <div className="ht-mono text-sm font-semibold" style={{ color: "var(--cyan)" }}>${totalValue.toFixed(2)}</div>
                <div className="text-xs" style={{ color: "var(--muted)" }}>Cards ({allRows.length})</div>
              </div>
              <div style={{ width: 1, height: 24, background: "var(--line)" }} />
              <div>
                <div className="ht-mono text-sm font-semibold" style={{ color: "var(--green)" }}>${sealedValue.toFixed(2)}</div>
                <div className="text-xs" style={{ color: "var(--muted)" }}>Sealed ({sealedInventory.reduce((s, p) => s + p.qty, 0)} units)</div>
              </div>
              <div style={{ width: 1, height: 24, background: "var(--line)" }} />
              <div>
                <div className="ht-mono text-sm font-semibold" style={{ color: (sealedValue - sealedCost) + totalProfit >= 0 ? "var(--green)" : "var(--red)" }}>
                  {(sealedValue - sealedCost) + totalProfit >= 0 ? "+" : "-"}${Math.abs((sealedValue - sealedCost) + totalProfit).toFixed(2)}
                </div>
                <div className="text-xs" style={{ color: "var(--muted)" }}>Total Profit</div>
              </div>
            </div>
          </div>

          {/* inline portfolio search — live item results as you type */}
          {portfolioListSearchOpen && (
            <div className="px-4 mb-3 ht-fade">
              <input autoFocus value={portfolioListSearch} onChange={(e) => setPortfolioListSearch(e.target.value)}
                placeholder="Search portfolios or the cards inside them..." className="ht-input rounded-lg px-3 py-2.5 text-sm w-full" />

              {portfolioListSearch.trim() && (() => {
                const q = portfolioListSearch.trim().toLowerCase();
                const cardHits = allRows
                  .filter(r => r.name.toLowerCase().includes(q) || (r.set || "").toLowerCase().includes(q) || (r.condition || "").toLowerCase().includes(q))
                  .map(r => ({ kind: "card", key: `c-${r.id}`, data: r }));
                const sealedHits = sealedPortfolios.flatMap(sp => sp.items
                  .filter(i => i.productName.toLowerCase().includes(q))
                  .map(i => ({ kind: "sealed", key: `s-${i.id}`, data: { ...i, portfolioName: sp.name } })));
                const hits = [...cardHits, ...sealedHits].slice(0, 8);
                return (
                  <div className="mt-2 ht-fade">
                    {hits.length === 0 && (
                      <p className="text-xs text-center py-3" style={{ color: "var(--muted)" }}>Nothing in your collection matches "{portfolioListSearch.trim()}".</p>
                    )}
                    <div className="flex flex-col gap-1.5">
                      {hits.map(it => it.kind === "card" ? (
                        <div key={it.key} onClick={() => openCardDetail(it.data)} className="ht-card p-2.5 flex items-center gap-2.5" style={{ cursor: "pointer" }}>
                          <CatDot category={it.data.category} />
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium truncate">{it.data.name}</div>
                            <div className="text-xs truncate" style={{ color: "var(--muted)" }}>{it.data.condition} · {it.data.portfolioName}</div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <div className="ht-mono text-xs font-semibold">${((it.data.price || 0) * it.data.qty).toFixed(2)}</div>
                            <TrendTag pct={it.data.trendPct || 0} />
                          </div>
                        </div>
                      ) : (
                        <div key={it.key} onClick={() => openSealedDetail(it.data)} className="ht-card p-2.5 flex items-center gap-2.5" style={{ cursor: "pointer" }}>
                          <CatDot category={it.data.category} />
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium truncate">{it.data.productName}</div>
                            <div className="text-xs truncate" style={{ color: "var(--muted)" }}>Sealed · {it.data.qty} unit{it.data.qty === 1 ? "" : "s"} · {it.data.portfolioName}</div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <div className="ht-mono text-xs font-semibold">${(it.data.marketEach * it.data.qty).toFixed(2)}</div>
                            <TrendTag pct={sealedItemTrendPct(it.data.productName)} />
                          </div>
                        </div>
                      ))}
                    </div>
                    <button onClick={() => { setAllItemsOpen(true); setAllItemsFilter("all"); setAllItemsSearch(portfolioListSearch); }} className="w-full text-center text-xs font-semibold py-2 mt-1" style={{ color: "var(--cyan)" }}>
                      See all results in All Portfolios →
                    </button>
                  </div>
                );
              })()}
            </div>
          )}

          {/* all portfolios — every item in one list */}
          <div className="mx-4 mb-3">
            <button onClick={() => { setAllItemsOpen(true); setAllItemsFilter("all"); setAllItemsSearch(""); }} className="ht-card p-3.5 flex items-center gap-3 text-left w-full">
              <div className="rounded-lg w-10 h-10 flex items-center justify-center flex-shrink-0" style={{ background: "var(--panel-2)" }}><Layers size={18} color="var(--purple)" /></div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold">All Portfolios</div>
                <div className="text-xs" style={{ color: "var(--muted)" }}>Every card &amp; sealed item in your whole collection</div>
              </div>
              <ChevronRight size={16} color="var(--muted)" className="flex-shrink-0" />
            </button>
          </div>

          {/* cards / sealed toggle */}
          <div className="mx-4 mb-4 rounded-lg p-1 flex" style={{ background: "var(--panel-2)", border: "1px solid var(--line)" }}>
            <button onClick={() => setPortfolioSection("cards")} className="flex-1 rounded-md py-2 text-xs font-semibold"
              style={{ background: portfolioSection === "cards" ? "var(--purple)" : "transparent", color: portfolioSection === "cards" ? "#fff" : "var(--muted)" }}>
              Cards
            </button>
            <button onClick={() => setPortfolioSection("sealed")} className="flex-1 rounded-md py-2 text-xs font-semibold"
              style={{ background: portfolioSection === "sealed" ? "var(--purple)" : "transparent", color: portfolioSection === "sealed" ? "#fff" : "var(--muted)" }}>
              Sealed
            </button>
          </div>

          <div className="px-4 flex justify-end mb-2" style={{ marginTop: -8 }}>
            <button onClick={() => { setPortfolioReorderMode(m => !m); setPortfolioListSearchOpen(false); setPortfolioListSearch(""); }} className={`ht-chip ${portfolioReorderMode ? "ht-chip-active" : ""}`}>{portfolioReorderMode ? "Done" : "Reorder"}</button>
          </div>

          {portfolioSection === "cards" && (
            <>
              {newPortfolioOpen && (
                <div className="mx-4 ht-card p-3 mb-3 ht-fade flex items-center gap-2">
                  <input value={newPortfolioName} onChange={(e) => setNewPortfolioName(e.target.value)} placeholder="Portfolio name"
                    className="ht-input rounded-md px-3 py-2 text-sm flex-1" />
                  <button onClick={() => {
                    if (!newPortfolioName.trim()) return;
                    setPortfolios(p => [...p, { id: `p-${Date.now()}`, name: newPortfolioName.trim(), accent: "var(--cyan)", rows: [] }]);
                    setNewPortfolioName(""); setNewPortfolioOpen(false);
                  }} className="ht-btn-primary rounded-md px-3 py-2 text-sm font-semibold">Create</button>
                  <button onClick={() => setNewPortfolioOpen(false)}><X size={16} color="var(--muted)" /></button>
                </div>
              )}

              <div className="px-4 flex flex-col gap-2 mb-6">
                {(portfolioReorderMode ? portfolios : portfolios.filter(p => {
                  const q = portfolioListSearch.trim().toLowerCase();
                  if (!portfolioListSearchOpen || !q) return true;
                  return p.name.toLowerCase().includes(q) || p.rows.some(r => r.name.toLowerCase().includes(q) || (r.set || "").toLowerCase().includes(q));
                })).map((p, idx) => {
                  const value = p.rows.reduce((s, r) => s + (r.price || 0) * r.qty, 0);
                  const trend = p.rows.length ? p.rows.reduce((s, r) => s + (r.trendPct || 0), 0) / p.rows.length : 0;
                  const isDragging = portfolioReorderMode && pfDragIdx === idx && pfDragRef.current?.list === "cards";
                  return (
                    <div key={p.id} data-pfrow="cards" data-idx={idx}
                      onClick={() => { if (!portfolioReorderMode) { setActivePortfolioId(p.id); setPortfolioDetailSearch(""); } }}
                      className="ht-card p-4 flex items-center justify-between text-left"
                      style={{ cursor: portfolioReorderMode ? "default" : "pointer", borderColor: isDragging ? "var(--cyan)" : undefined, transform: isDragging ? "scale(1.02)" : "none", transition: "transform .12s" }}>
                      <div className="flex items-center gap-3 min-w-0">
                        {portfolioReorderMode && (
                          <span onPointerDown={(e) => startPortfolioDrag(e, "cards", idx)} style={{ touchAction: "none", cursor: "grab" }} className="flex-shrink-0">
                            <GripVertical size={18} color="var(--muted)" />
                          </span>
                        )}
                        <div style={{ width: 8, height: 32, borderRadius: 4, background: p.accent }} />
                        <div className="min-w-0">
                          <div className="text-sm font-semibold truncate">{p.name}</div>
                          <div className="text-xs" style={{ color: "var(--muted)" }}>{p.rows.length} cards</div>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0 ml-2 flex items-center gap-2">
                        <div>
                          <div className="ht-mono text-sm font-semibold">${value.toFixed(2)}</div>
                          <TrendTag pct={Math.round(trend * 10) / 10} />
                        </div>
                        {!portfolioReorderMode && <ChevronRight size={16} color="var(--muted)" />}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* your card gainers & losers */}
              {allRows.length > 0 && (
                <>
                  <div className="flex items-center justify-between px-4 mb-2">
                    <h2 className="text-sm font-semibold">Your Gainers &amp; Losers</h2>
                    <div className="flex rounded-full p-0.5" style={{ background: "var(--panel-2)" }}>
                      <button onClick={() => setPortfolioMoverTab("gainers")} className="px-3 py-1 rounded-full text-xs font-semibold"
                        style={{ background: portfolioMoverTab === "gainers" ? "var(--green)" : "transparent", color: portfolioMoverTab === "gainers" ? "#0A0912" : "var(--muted)" }}>
                        Gainers
                      </button>
                      <button onClick={() => setPortfolioMoverTab("losers")} className="px-3 py-1 rounded-full text-xs font-semibold"
                        style={{ background: portfolioMoverTab === "losers" ? "var(--red)" : "transparent", color: portfolioMoverTab === "losers" ? "#0A0912" : "var(--muted)" }}>
                        Losers
                      </button>
                    </div>
                  </div>
                  <div className="px-4 flex flex-col gap-2 mb-6">
                    {(portfolioMoverTab === "gainers"
                      ? [...allRows].sort((a, b) => (b.trendPct || 0) - (a.trendPct || 0))
                      : [...allRows].sort((a, b) => (a.trendPct || 0) - (b.trendPct || 0))
                    ).slice(0, 5).map((r, i) => (
                      <div key={r.id} onClick={() => openCardDetail(r)} className="ht-card p-3 flex items-center justify-between" style={{ cursor: "pointer" }}>
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="ht-mono text-xs font-semibold flex-shrink-0" style={{ color: "var(--muted)", width: 14 }}>{i + 1}</span>
                          <CatDot category={r.category} />
                          <div className="min-w-0">
                            <div className="text-sm font-medium truncate">{r.name}</div>
                            <div className="text-xs truncate" style={{ color: "var(--muted)" }}>{r.condition} · {r.portfolioName}</div>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0 ml-2">
                          <div className="ht-mono text-sm font-semibold">${(r.price || 0).toFixed(2)}</div>
                          <TrendTag pct={r.trendPct || 0} />
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          )}

          {portfolioSection === "sealed" && (
            <>
              {newSealedPortfolioOpen && (
                <div className="mx-4 ht-card p-3 mb-3 ht-fade flex items-center gap-2">
                  <input value={newSealedPortfolioName} onChange={(e) => setNewSealedPortfolioName(e.target.value)} placeholder="Sealed portfolio name"
                    className="ht-input rounded-md px-3 py-2 text-sm flex-1" />
                  <button onClick={() => {
                    if (!newSealedPortfolioName.trim()) return;
                    setSealedPortfolios(p => [...p, { id: `sp-${Date.now()}`, name: newSealedPortfolioName.trim(), accent: "var(--green)", items: [] }]);
                    setNewSealedPortfolioName(""); setNewSealedPortfolioOpen(false);
                  }} className="ht-btn-primary rounded-md px-3 py-2 text-sm font-semibold">Create</button>
                  <button onClick={() => setNewSealedPortfolioOpen(false)}><X size={16} color="var(--muted)" /></button>
                </div>
              )}

              <div className="px-4 flex flex-col gap-2 mb-6">
                {(portfolioReorderMode ? sealedPortfolios : sealedPortfolios.filter(p => {
                  const q = portfolioListSearch.trim().toLowerCase();
                  if (!portfolioListSearchOpen || !q) return true;
                  return p.name.toLowerCase().includes(q) || p.items.some(i => i.productName.toLowerCase().includes(q));
                })).map((p, idx) => {
                  const value = p.items.reduce((s, i) => s + i.marketEach * i.qty, 0);
                  const cost = p.items.reduce((s, i) => s + i.costEach * i.qty, 0);
                  const units = p.items.reduce((s, i) => s + i.qty, 0);
                  const isDragging = portfolioReorderMode && pfDragIdx === idx && pfDragRef.current?.list === "sealed";
                  return (
                    <div key={p.id} data-pfrow="sealed" data-idx={idx}
                      onClick={() => { if (!portfolioReorderMode) { setActiveSealedPortfolioId(p.id); setPortfolioDetailSearch(""); } }}
                      className="ht-card p-4 flex items-center justify-between text-left"
                      style={{ cursor: portfolioReorderMode ? "default" : "pointer", borderColor: isDragging ? "var(--cyan)" : undefined, transform: isDragging ? "scale(1.02)" : "none", transition: "transform .12s" }}>
                      <div className="flex items-center gap-3 min-w-0">
                        {portfolioReorderMode && (
                          <span onPointerDown={(e) => startPortfolioDrag(e, "sealed", idx)} style={{ touchAction: "none", cursor: "grab" }} className="flex-shrink-0">
                            <GripVertical size={18} color="var(--muted)" />
                          </span>
                        )}
                        <div style={{ width: 8, height: 32, borderRadius: 4, background: p.accent }} />
                        <div className="min-w-0">
                          <div className="text-sm font-semibold truncate">{p.name}</div>
                          <div className="text-xs" style={{ color: "var(--muted)" }}>{units} units</div>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0 ml-2 flex items-center gap-2">
                        <div>
                          <div className="ht-mono text-sm font-semibold">${value.toFixed(2)}</div>
                          <span className="ht-mono text-xs font-semibold" style={{ color: value - cost >= 0 ? "var(--green)" : "var(--red)" }}>
                            {value - cost >= 0 ? "+" : "-"}${Math.abs(value - cost).toFixed(2)}
                          </span>
                        </div>
                        {!portfolioReorderMode && <ChevronRight size={16} color="var(--muted)" />}
                      </div>
                    </div>
                  );
                })}
                {sealedPortfolios.length === 0 && <p className="px-0 text-xs" style={{ color: "var(--muted)" }}>No sealed portfolios yet — tap + to create one.</p>}
              </div>

              {/* your sealed gainers & losers */}
              {sealedInventory.length > 0 && (
                <>
                  <div className="flex items-center justify-between px-4 mb-2">
                    <h2 className="text-sm font-semibold">Your Gainers &amp; Losers</h2>
                    <div className="flex rounded-full p-0.5" style={{ background: "var(--panel-2)" }}>
                      <button onClick={() => setPortfolioSealedMoverTab("gainers")} className="px-3 py-1 rounded-full text-xs font-semibold"
                        style={{ background: portfolioSealedMoverTab === "gainers" ? "var(--green)" : "transparent", color: portfolioSealedMoverTab === "gainers" ? "#0A0912" : "var(--muted)" }}>
                        Gainers
                      </button>
                      <button onClick={() => setPortfolioSealedMoverTab("losers")} className="px-3 py-1 rounded-full text-xs font-semibold"
                        style={{ background: portfolioSealedMoverTab === "losers" ? "var(--red)" : "transparent", color: portfolioSealedMoverTab === "losers" ? "#0A0912" : "var(--muted)" }}>
                        Losers
                      </button>
                    </div>
                  </div>
                  <div className="px-4 flex flex-col gap-2 mb-6">
                    {(() => {
                      const withTrend = sealedInventory.map(item => ({ ...item, changePct: sealedItemTrendPct(item.productName) }));
                      const sorted = portfolioSealedMoverTab === "gainers"
                        ? withTrend.sort((a, b) => b.changePct - a.changePct)
                        : withTrend.sort((a, b) => a.changePct - b.changePct);
                      return sorted.slice(0, 5).map((item, i) => (
                        <div key={item.id} onClick={() => openSealedDetail(item)} className="ht-card p-3 flex items-center justify-between" style={{ cursor: "pointer" }}>
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="ht-mono text-xs font-semibold flex-shrink-0" style={{ color: "var(--muted)", width: 14 }}>{i + 1}</span>
                            <CatDot category={item.category} />
                            <div className="min-w-0">
                              <div className="text-sm font-medium truncate">{item.productName}</div>
                              <div className="text-xs truncate" style={{ color: "var(--muted)" }}>{item.qty} unit{item.qty === 1 ? "" : "s"} held</div>
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0 ml-2">
                            <div className="ht-mono text-sm font-semibold">${item.marketEach.toFixed(2)}</div>
                            <TrendTag pct={item.changePct} />
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                </>
              )}
            </>
          )}

          {/* watchlist entry point, lives under the portfolios */}
          <div className="px-4 mb-6">
            <button onClick={() => setTab("watchlist")} className="ht-card p-4 flex items-center gap-3 text-left w-full">
              <div className="rounded-lg w-11 h-11 flex items-center justify-center flex-shrink-0" style={{ background: "var(--panel-2)" }}><Bell size={19} color="var(--cyan)" /></div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold">Watchlist</div>
                <div className="text-xs" style={{ color: "var(--muted)" }}>{watchlist.length} card{watchlist.length === 1 ? "" : "s"} &amp; products being tracked</div>
              </div>
              <ChevronRight size={16} color="var(--muted)" className="flex-shrink-0" />
            </button>
          </div>
        </div>
        );
      })()}

      {/* ---- Portfolio: active Sealed portfolio detail ---- */}
      {tab === "portfolio" && activeSealedPortfolio && !sealedDetail && (
        <div className="ht-fade">
          <div className="px-4 pt-6 pb-3 flex items-center gap-3">
            <button onClick={() => setActiveSealedPortfolioId(null)}><ArrowLeft size={18} /></button>
            <div className="min-w-0">
              <h1 className="text-lg font-semibold truncate">{activeSealedPortfolio.name}</h1>
              <div className="flex items-center gap-2 text-xs">
                <span className="ht-mono" style={{ color: "var(--muted)" }}>
                  ${activeSealedPortfolio.items.reduce((s, i) => s + i.marketEach * i.qty, 0).toFixed(2)} · {activeSealedPortfolio.items.reduce((s, i) => s + i.qty, 0)} units
                </span>
                {(() => {
                  const p = activeSealedPortfolio.items.reduce((s, i) => s + (i.marketEach - i.costEach) * i.qty, 0);
                  return <span className="ht-mono font-semibold" style={{ color: p >= 0 ? "var(--green)" : "var(--red)" }}>{p >= 0 ? "+" : "-"}${Math.abs(p).toFixed(2)} P/L</span>;
                })()}
              </div>
            </div>
          </div>

          <div className="px-4 pb-6">
            <div className="ht-card p-4 mb-4">
              <div className="text-xs font-semibold mb-2" style={{ color: "var(--muted)" }}>ADD SEALED PRODUCT</div>
              <input value={sealedForm.productName} onChange={(e) => setSealedForm(f => ({ ...f, productName: e.target.value }))} placeholder="Product name (e.g. Evolving Skies Booster Box)" className="ht-input rounded-md px-3 py-2 text-xs w-full mb-2" />
              <div className="flex gap-2 flex-wrap">
                <select value={sealedForm.category} onChange={(e) => setSealedForm(f => ({ ...f, category: e.target.value }))} className="ht-input rounded-md px-2 py-2 text-xs">
                  {CATEGORIES.map(c => <option key={c.key} value={c.key} style={{ background: "var(--panel-2)" }}>{c.label}</option>)}
                </select>
                <input type="number" value={sealedForm.qty} onChange={(e) => setSealedForm(f => ({ ...f, qty: e.target.value }))} placeholder="Qty" className="ht-input ht-mono rounded-md px-2 py-2 text-xs w-16" />
                <input type="number" value={sealedForm.costEach} onChange={(e) => setSealedForm(f => ({ ...f, costEach: e.target.value }))} placeholder="Cost ea" className="ht-input ht-mono rounded-md px-2 py-2 text-xs w-24" />
                <input type="number" value={sealedForm.marketEach} onChange={(e) => setSealedForm(f => ({ ...f, marketEach: e.target.value }))} placeholder="Market ea" className="ht-input ht-mono rounded-md px-2 py-2 text-xs w-24" />
              </div>
              <button onClick={addSealed} className="ht-btn-primary rounded-md py-2 text-xs font-semibold w-full mt-2 flex items-center justify-center gap-1.5"><Plus size={13} /> Add Product</button>
            </div>

            <SectionHeader title={`Inventory (${activeSealedPortfolio.items.reduce((s, i) => s + i.qty, 0)} units)`} />
            {activeSealedPortfolio.items.length > 3 && (
              <input value={portfolioDetailSearch} onChange={(e) => setPortfolioDetailSearch(e.target.value)}
                placeholder="Search this portfolio..." className="ht-input rounded-lg px-3 py-2.5 text-sm w-full mb-2" />
            )}
            <div className="flex flex-col gap-2">
              {activeSealedPortfolio.items.filter(p => {
                const q = portfolioDetailSearch.trim().toLowerCase();
                return !q || p.productName.toLowerCase().includes(q);
              }).map(p => {
                const profit = (p.marketEach - p.costEach) * p.qty;
                return (
                  <div key={p.id} className="ht-card p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0" onClick={() => openSealedDetail(p)} style={{ cursor: "pointer" }}>
                        <div className="flex items-center gap-1.5">
                          <CatDot category={p.category} />
                          <div className="text-sm font-semibold truncate">{p.productName}</div>
                        </div>
                        <div className="text-xs mt-1" style={{ color: "var(--muted)" }}>{p.qty} units · ${p.costEach.toFixed(2)} cost / ${p.marketEach.toFixed(2)} market ea</div>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button onClick={() => toggleSealedWatch(p)} className="rounded-full w-6 h-6 flex items-center justify-center" style={{ background: isSealedWatched(p) ? "var(--cyan)" : "var(--panel-2)", border: "1px solid var(--line)" }} title="Add to watchlist">
                          <Bell size={11} color={isSealedWatched(p) ? "#0A0912" : "var(--muted)"} />
                        </button>
                        <button onClick={() => removeSealed(p.id)}><Trash2 size={14} color="var(--muted)" /></button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-2 pt-2" style={{ borderTop: "1px solid var(--line)" }}>
                      <span className="text-xs" style={{ color: "var(--muted)" }}>Unrealized profit</span>
                      <span className="ht-mono text-sm font-semibold" style={{ color: profit >= 0 ? "var(--green)" : "var(--red)" }}>{profit >= 0 ? "+" : "-"}${Math.abs(profit).toFixed(2)}</span>
                    </div>
                  </div>
                );
              })}
              {activeSealedPortfolio.items.length === 0 && <p className="text-xs" style={{ color: "var(--muted)" }}>No products in this portfolio yet — add one above.</p>}
            </div>
          </div>
        </div>
      )}

      {tab === "portfolio" && activePortfolio && !cardDetail && (() => {
        const portfolioProfit = activePortfolio.rows.reduce((s, r) => s + (r.costBasis != null ? (r.price - r.costBasis) * r.qty : 0), 0);
        const updatePortfolioRow = (rowId, patch) => {
          setPortfolios(ps => ps.map(p => (p.id !== activePortfolio.id ? p : { ...p, rows: p.rows.map(r => (r.id === rowId ? { ...r, ...patch } : r)) })));
        };
        return (
        <div className="ht-fade">
          <div className="px-4 pt-6 pb-3 flex items-center gap-3">
            <button onClick={() => setActivePortfolioId(null)}><ArrowLeft size={18} /></button>
            <div className="min-w-0">
              <h1 className="text-lg font-semibold truncate">{activePortfolio.name}</h1>
              <div className="flex items-center gap-2 text-xs">
                <span className="ht-mono" style={{ color: "var(--muted)" }}>
                  ${activePortfolio.rows.reduce((s, r) => s + (r.price || 0) * r.qty, 0).toFixed(2)} · {activePortfolio.rows.length} cards
                </span>
                <span className="ht-mono font-semibold" style={{ color: portfolioProfit >= 0 ? "var(--green)" : "var(--red)" }}>
                  {portfolioProfit >= 0 ? "+" : "-"}${Math.abs(portfolioProfit).toFixed(2)} P/L
                </span>
              </div>
            </div>
          </div>

          <div className="px-4 mb-3">
            <button onClick={() => loadPortfolioIntoPricer(activePortfolio)} className="ht-btn-primary rounded-lg py-2.5 text-sm font-semibold w-full flex items-center justify-center gap-2">
              <Tag size={15} /> Price &amp; Label These Cards
            </button>
          </div>

          {activePortfolio.rows.length > 3 && (
            <div className="px-4 mb-3">
              <input value={portfolioDetailSearch} onChange={(e) => setPortfolioDetailSearch(e.target.value)}
                placeholder="Search this portfolio..." className="ht-input rounded-lg px-3 py-2.5 text-sm w-full" />
            </div>
          )}

          <div className="px-4 flex flex-col gap-2 mb-6">
            {activePortfolio.rows.filter(r => {
              const q = portfolioDetailSearch.trim().toLowerCase();
              if (!q) return true;
              return r.name.toLowerCase().includes(q) || (r.set || "").toLowerCase().includes(q) || (r.condition || "").toLowerCase().includes(q);
            }).map(r => {
              const profit = r.costBasis != null ? (r.price - r.costBasis) * r.qty : null;
              return (
                <div key={r.id} className="ht-card p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0" onClick={() => openCardDetail(r)} style={{ cursor: "pointer" }}>
                      <CatDot category={r.category} />
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{r.name}</div>
                        <div className="text-xs truncate" style={{ color: "var(--muted)" }}>{r.set} · {r.condition} · qty {r.qty}</div>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0 ml-2 flex items-start gap-1.5">
                      <div>
                        <div className="ht-mono text-sm font-semibold">${r.price?.toFixed(2)}</div>
                        <TrendTag pct={r.trendPct} />
                      </div>
                      <button onClick={() => toggleCardWatch(r)} className="rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0" style={{ background: isCardWatched(r) ? "var(--cyan)" : "var(--panel-2)", border: "1px solid var(--line)" }} title="Add to watchlist">
                        <Bell size={11} color={isCardWatched(r) ? "#0A0912" : "var(--muted)"} />
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-2 pt-2" style={{ borderTop: "1px solid var(--line)" }}>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs" style={{ color: "var(--muted)" }}>You paid</span>
                      <span className="ht-mono text-xs" style={{ color: "var(--muted)" }}>$</span>
                      <input type="number" value={r.costBasis ?? ""} placeholder="0.00"
                        onChange={(e) => updatePortfolioRow(r.id, { costBasis: e.target.value === "" ? null : Number(e.target.value) })}
                        className="bg-transparent outline-none ht-mono text-xs w-16" style={{ color: "var(--text)" }} />
                    </div>
                    <div className="flex items-center gap-2">
                      {profit !== null && (
                        <span className="ht-mono text-xs font-semibold" style={{ color: profit >= 0 ? "var(--green)" : "var(--red)" }}>
                          {profit >= 0 ? "+" : "-"}${Math.abs(profit).toFixed(2)}
                        </span>
                      )}
                      <button onClick={() => { setSellingRowId(r.id); setSellPrice(String(r.price ?? "")); }} className="text-xs font-semibold" style={{ color: "var(--cyan)" }}>Sell</button>
                    </div>
                  </div>
                  {sellingRowId === r.id && (
                    <div className="mt-2 pt-2 flex items-center gap-2 flex-wrap ht-fade" style={{ borderTop: "1px solid var(--line)" }}>
                      <select value={sellPlatform} onChange={(e) => setSellPlatform(e.target.value)} className="ht-input rounded-md px-2 py-1.5 text-xs">
                        {Object.entries(PLATFORM_FEES).map(([k, v]) => <option key={k} value={k} style={{ background: "var(--panel-2)" }}>{v.label}</option>)}
                      </select>
                      <div className="flex items-center gap-1">
                        <span className="ht-mono text-xs" style={{ color: "var(--muted)" }}>$</span>
                        <input type="number" value={sellPrice} onChange={(e) => setSellPrice(e.target.value)} className="ht-input ht-mono rounded-md px-2 py-1.5 text-xs w-20" />
                      </div>
                      <button onClick={() => { sellCard(activePortfolio.id, r, Number(sellPrice) || r.price, sellPlatform); setSellingRowId(null); }}
                        className="ht-btn-primary rounded-md px-3 py-1.5 text-xs font-semibold">Confirm Sale</button>
                      <button onClick={() => setSellingRowId(null)} className="text-xs" style={{ color: "var(--muted)" }}>Cancel</button>
                    </div>
                  )}
                </div>
              );
            })}
            {activePortfolio.rows.length === 0 && <p className="text-xs" style={{ color: "var(--muted)" }}>No cards yet — add some from Tools.</p>}
            {activePortfolio.rows.length > 0 && portfolioDetailSearch.trim() && activePortfolio.rows.filter(r => { const q = portfolioDetailSearch.trim().toLowerCase(); return r.name.toLowerCase().includes(q) || (r.set || "").toLowerCase().includes(q) || (r.condition || "").toLowerCase().includes(q); }).length === 0 && <p className="text-xs" style={{ color: "var(--muted)" }}>No cards match "{portfolioDetailSearch.trim()}".</p>}
          </div>
        </div>
        );
      })()}

      {/* ============ TOOLS ============ */}
      {tab === "tools" && toolsView === "menu" && (
        <div className="ht-fade px-4 pt-6 pb-6">
          <div className="flex items-center justify-between mb-4">
            <h1 className="ht-display text-3xl leading-none">TOOLS</h1>
            <button onClick={() => setToolsReorderMode(m => !m)} className={`ht-chip ${toolsReorderMode ? "ht-chip-active" : ""}`}>{toolsReorderMode ? "Done" : "Reorder"}</button>
          </div>
          {TOOL_CATEGORIES.map(cat => (
            <div key={cat.key} className="mb-4">
              <div className="text-xs font-semibold mb-2" style={{ color: "var(--muted)", letterSpacing: "0.06em" }}>{cat.label.toUpperCase()}</div>
              <div className="grid grid-cols-2 gap-2 tablet-cols-3">
                {toolsOrder[cat.key].map((toolKey, idx) => {
                  const meta = TOOL_META[toolKey];
                  if (!meta) return null;
                  const Icon = meta.icon;
                  const dragKind = `tool-${cat.key}`;
                  const isDragging = gridDragKey === `${dragKind}:${idx}`;
                  return (
                    <div key={toolKey} data-dragrow={dragKind} data-idx={idx} className="ht-card p-3 relative"
                      style={{ borderColor: isDragging ? "var(--cyan)" : undefined, transform: isDragging ? "scale(1.04)" : "none", transition: "transform .12s", zIndex: isDragging ? 5 : undefined }}>
                      <button onClick={() => { if (toolsReorderMode) return; if (PRO_TOOLS.includes(toolKey) && !gate(meta.label)) return; setToolsView(toolKey); }} className="w-full text-left flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                          <div className="rounded-lg w-9 h-9 flex items-center justify-center" style={{ background: "var(--panel-2)" }}><Icon size={17} color={meta.color} /></div>
                          {!isPro && PRO_TOOLS.includes(toolKey) && (
                            <span className="ht-mono text-xs font-bold px-1.5 py-0.5 rounded" style={{ background: "linear-gradient(90deg, var(--purple), var(--cyan))", color: "#0A0912" }}>PRO</span>
                          )}
                        </div>
                        <div>
                          <div className="text-sm font-semibold">{meta.short}</div>
                          <div className="text-xs leading-snug mt-0.5" style={{ color: "var(--muted)" }}>{meta.desc}</div>
                        </div>
                      </button>
                      {toolsReorderMode && (
                        <span onPointerDown={(e) => startGridDrag(e, dragKind, idx, moveToolByDrag(cat.key))}
                          className="absolute top-2 right-2 rounded-md p-1" style={{ background: "var(--panel-2)", touchAction: "none", cursor: "grab" }}>
                          <GripVertical size={14} color="var(--muted)" />
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ---- Price & Label Printer (accessed from Portfolio) ---- */}
      {tab === "tools" && toolsView === "pricer" && !labelView && (
        <div className="ht-fade">
          <div className="px-4 pt-6 pb-2 flex items-center gap-3">
            <button onClick={() => { setTab("portfolio"); setToolsView("menu"); }}><ArrowLeft size={18} /></button>
            <h1 className="text-lg font-semibold">Price &amp; Label</h1>
          </div>

          <div className="px-4 flex gap-2 flex-wrap mb-3">
            <button onClick={runTag} disabled={isTagging || rows.length === 0} className="ht-btn-primary rounded-lg px-3 py-2 text-xs font-semibold flex items-center gap-1.5">
              {isTagging ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
              {isTagging ? `Tagging ${tagIndex + 1}/${rows.length}` : "Tag Inventory"}
            </button>
            <button onClick={() => setRows(r => [...r, makeRow()])} className="ht-input rounded-lg px-3 py-2 text-xs flex items-center gap-1.5"><Plus size={13} /> Add</button>
            <button onClick={() => setPasteOpen(true)} className="ht-input rounded-lg px-3 py-2 text-xs flex items-center gap-1.5"><Tag size={13} /> Paste</button>
            <button onClick={() => fileRef.current?.click()} className="ht-input rounded-lg px-3 py-2 text-xs flex items-center gap-1.5"><Upload size={13} /> CSV</button>
            <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={(e) => { if (e.target.files[0]) importCSV(e.target.files[0]); e.target.value = ""; }} />
            <button onClick={() => setSettingsOpen(o => !o)} className="ht-input rounded-lg px-3 py-2 text-xs flex items-center gap-1.5"><Settings2 size={13} /> Labels</button>
          </div>

          {pasteOpen && (
            <div className="mx-4 ht-card p-3 mb-3 ht-fade">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold">Name, Set, Condition, Qty — one per line</span>
                <button onClick={() => setPasteOpen(false)}><X size={14} color="var(--muted)" /></button>
              </div>
              <textarea value={pasteText} onChange={(e) => setPasteText(e.target.value)} rows={3}
                placeholder={"Charizard 4/102, Base Set, PSA 9, 1"} className="ht-input ht-mono w-full rounded-md p-2 text-xs" />
              <button onClick={importPaste} className="ht-btn-primary rounded-md px-3 py-2 text-xs font-semibold mt-2">Add</button>
            </div>
          )}

          {settingsOpen && (
            <div className="mx-4 ht-card p-4 mb-3 ht-fade">
              <div className="text-xs font-semibold mb-2" style={{ color: "var(--muted)" }}>LOGO</div>
              <div className="flex items-center gap-2 mb-3">
                <button onClick={() => logoRef.current?.click()} className="ht-input rounded-md px-3 py-2 text-xs flex items-center gap-1.5"><ImageIcon size={13} /> {labelSettings.logoDataUrl ? "Replace" : "Upload"}</button>
                {labelSettings.logoDataUrl && <><img src={labelSettings.logoDataUrl} alt="logo" style={{ height: 24, width: 24, background: "white", borderRadius: 4, objectFit: "contain" }} /><button onClick={() => setLabelSettings(s => ({ ...s, logoDataUrl: null }))}><X size={13} color="var(--muted)" /></button></>}
              </div>
              <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={(e) => { if (e.target.files[0]) handleLogoUpload(e.target.files[0]); e.target.value = ""; }} />

              <div className="text-xs font-semibold mb-2" style={{ color: "var(--muted)" }}>ROUNDING</div>
              <div className="flex gap-2 flex-wrap mb-3">
                <select value={labelSettings.roundMode} onChange={(e) => setLabelSettings(s => ({ ...s, roundMode: e.target.value }))} className="ht-input rounded-md px-2 py-2 text-xs">
                  {ROUND_MODES.map(m => <option key={m.value} value={m.value} style={{ background: "var(--panel-2)" }}>{m.label}</option>)}
                </select>
                {labelSettings.roundMode !== "none" && (
                  <select value={labelSettings.roundIncrement} onChange={(e) => setLabelSettings(s => ({ ...s, roundIncrement: Number(e.target.value) }))} className="ht-input ht-mono rounded-md px-2 py-2 text-xs">
                    {ROUND_INCREMENTS.map(i => <option key={i} value={i} style={{ background: "var(--panel-2)" }}>${i.toFixed(2)}</option>)}
                  </select>
                )}
              </div>

              <div className="text-xs font-semibold mb-2" style={{ color: "var(--muted)" }}>ADJUSTMENT %</div>
              <input type="number" value={labelSettings.adjustPct} onChange={(e) => setLabelSettings(s => ({ ...s, adjustPct: Number(e.target.value) || 0 }))} className="ht-input ht-mono rounded-md px-3 py-2 text-xs w-24 mb-3" />

              <button onClick={() => setLabelSettings(s => ({ ...s, showQr: !s.showQr }))} className="text-xs font-semibold flex items-center gap-2 mb-2" style={{ color: "var(--muted)" }}>
                {labelSettings.showQr ? <CheckSquare size={13} color="var(--cyan)" /> : <Square size={13} />} QR CODE
              </button>
              {labelSettings.showQr && <input value={labelSettings.qrContent} onChange={(e) => setLabelSettings(s => ({ ...s, qrContent: e.target.value }))} placeholder="holorelix.com" className="ht-input rounded-md px-3 py-2 text-xs w-full mb-3" />}

              <button onClick={() => setLabelSettings(s => ({ ...s, showMeta: !s.showMeta }))} className="text-xs font-semibold flex items-center gap-2" style={{ color: "var(--muted)" }}>
                {labelSettings.showMeta ? <CheckSquare size={13} color="var(--cyan)" /> : <Square size={13} />} SHOW SET/CONDITION
              </button>
            </div>
          )}

          <div className="px-4 flex flex-col gap-2 mb-4">
            {rows.map(row => {
              const lp = row.status === "priced" ? computeLabelPrice(row.price, labelSettings) : null;
              return (
                <div key={row.id} className={`ht-card p-3 ${row.status === "forging" ? "ht-row-forging" : ""}`}>
                  <div className="flex items-center gap-2">
                    <button onClick={() => updateRow(row.id, { selected: !row.selected })} disabled={row.status !== "priced"}>
                      {row.selected ? <CheckSquare size={14} color="var(--cyan)" /> : <Square size={14} color="var(--muted)" />}
                    </button>
                    <input value={row.name} onChange={(e) => updateRow(row.id, { name: e.target.value })} placeholder="Card name"
                      className="bg-transparent outline-none text-sm flex-1 min-w-0" style={{ color: "var(--text)" }} />
                    <button onClick={() => removeRow(row.id)}><Trash2 size={14} color="var(--muted)" /></button>
                  </div>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <input value={row.set} onChange={(e) => updateRow(row.id, { set: e.target.value })} placeholder="Set"
                      className="bg-transparent outline-none text-xs w-20" style={{ color: "var(--muted)" }} />
                    <select value={row.condition} onChange={(e) => updateRow(row.id, { condition: e.target.value })} className="bg-transparent outline-none text-xs ht-mono" style={{ color: "var(--cyan)" }}>
                      {CONDITIONS.map(c => <option key={c} value={c} style={{ background: "var(--panel-2)" }}>{c}</option>)}
                    </select>
                    <select value={row.nameMode} onChange={(e) => updateRow(row.id, { nameMode: e.target.value })} className="bg-transparent outline-none text-xs" style={{ color: "var(--purple)" }}>
                      <option value="single" style={{ background: "var(--panel-2)" }}>TCG</option>
                      <option value="double" style={{ background: "var(--panel-2)" }}>Sports</option>
                    </select>
                    <input type="number" min={1} value={row.qty} onChange={(e) => updateRow(row.id, { qty: Number(e.target.value) || 1 })}
                      className="bg-transparent outline-none text-xs w-10 ht-mono ml-auto" style={{ color: "var(--text)" }} />
                    <span className="ht-mono text-xs font-semibold">{lp != null ? `$${lp.toFixed(2)}` : "—"}</span>
                    <TrendTag pct={row.trendPct} />
                  </div>
                </div>
              );
            })}
            {rows.length === 0 && <p className="text-xs text-center py-8" style={{ color: "var(--muted)" }}>No cards yet — paste a list, import a CSV, or add a row.</p>}
          </div>

          {printableRows.length > 0 && (
            <div className="px-4 mb-6 sticky bottom-0">
              <button onClick={() => { if (!gate("Price tag label printing")) return; setLabelView(true); }} className="ht-btn-primary rounded-lg py-3 text-sm font-semibold w-full flex items-center justify-center gap-2 relative">
                <Printer size={15} /> Print Labels ({printableRows.length})
                {!isPro && <span className="ht-mono text-xs font-bold px-1.5 py-0.5 rounded absolute" style={{ right: 10, background: "#0A0912", color: "var(--cyan)" }}>PRO</span>}
              </button>
            </div>
          )}
        </div>
      )}

      {tab === "tools" && toolsView === "pricer" && labelView && (
        <div className="ht-fade">
          <div className="px-4 pt-6 pb-3 flex items-center justify-between no-print">
            <button onClick={() => setLabelView(false)} className="flex items-center gap-1.5 text-sm"><ArrowLeft size={16} /> Back</button>
            <button onClick={() => window.print()} className="ht-btn-primary rounded-lg px-4 py-2 text-sm font-semibold flex items-center gap-2"><Printer size={14} /> Print</button>
          </div>
          <p className="px-4 pb-3 text-xs no-print" style={{ color: "var(--muted)" }}>40×14mm labels, 1 per row for a thermal roll printer.</p>
          <div className="ht-label-sheet px-4 pb-8" style={{ "--labels-per-row": labelSettings.labelsPerRow, display: "flex", flexDirection: "column", gap: "1.5mm", alignItems: "flex-start" }}>
            {printableRows.map(row => {
              const lp = computeLabelPrice(row.price, labelSettings);
              const { big, sub } = splitCardName(row.name, row.nameMode);
              return (
                <div key={row.id} className="ht-label">
                  {labelSettings.logoDataUrl && <img src={labelSettings.logoDataUrl} alt="logo" className="ht-label-logo" />}
                  <div className="ht-label-mid">
                    <FitText text={big} className="ht-label-name-big" maxSize={11.5} minSize={6} />
                    {sub && <div className="ht-label-sub">{sub}</div>}
                    {labelSettings.showMeta && <div className="ht-label-meta">{row.set} · {row.condition}</div>}
                  </div>
                  <div className="ht-label-price">${Math.round(lp)}</div>
                  {labelSettings.showQr && qrUrl && <img src={qrUrl} alt="QR" className="ht-label-qr" />}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ---- Tools: PSA Cert Lookup ---- */}
      {tab === "tools" && toolsView === "psa" && (
        <div className="ht-fade px-4 pt-6 pb-6">
          <div className="flex items-center gap-3 mb-3">
            <button onClick={() => { setToolsView("menu"); setCertResult(null); setCertInput(""); }}><ArrowLeft size={18} /></button>
            <h1 className="text-lg font-semibold">PSA Cert Lookup</h1>
          </div>

          <div className="flex items-center gap-2 text-xs mb-4" style={{ color: "var(--muted)" }}>
            <span className="w-2 h-2 rounded-full inline-block" style={{ background: "var(--amber)" }} />
            Simulated result — real lookups need a backend holding your PSA API token
          </div>

          <div className="flex gap-2 mb-4">
            <input value={certInput} onChange={(e) => setCertInput(e.target.value.replace(/[^0-9]/g, ""))}
              onKeyDown={(e) => e.key === "Enter" && runCertLookup()}
              placeholder="Cert number, e.g. 82736451" inputMode="numeric"
              className="ht-input ht-mono rounded-lg px-3 py-3 text-sm flex-1" />
            <button onClick={runCertLookup} disabled={certLoading || !certInput.trim()}
              className="ht-btn-primary rounded-lg px-4 py-3 text-sm font-semibold flex items-center gap-2">
              {certLoading ? <Loader2 size={15} className="animate-spin" /> : <ShieldCheck size={15} />}
              Verify
            </button>
          </div>

          {certResult && certResult.valid === false && (
            <div className="ht-card p-4 ht-fade flex items-center gap-3" style={{ borderColor: "var(--red)" }}>
              <XCircle size={22} color="var(--red)" />
              <div>
                <div className="text-sm font-semibold">Certificate not found</div>
                <div className="text-xs" style={{ color: "var(--muted)" }}>PSA cert numbers are 6–10 digits. Double-check the number and try again.</div>
              </div>
            </div>
          )}

          {certResult && certResult.valid && (
            <div className="ht-card p-4 ht-fade" style={{ borderColor: "var(--green)" }}>
              <div className="flex items-center gap-2 mb-3">
                <ShieldCheck size={16} color="var(--green)" />
                <span className="text-xs font-semibold" style={{ color: "var(--green)" }}>Certificate Verified</span>
                <span className="ht-mono text-xs ml-auto" style={{ color: "var(--muted)" }}>#{certResult.certNumber}</span>
              </div>

              {/* placeholder card visual — not a real PSA image */}
              <div className="rounded-lg mb-3 p-4 flex items-center gap-3" style={{ background: "var(--panel-2)", border: "1px dashed var(--line)" }}>
                <div className="rounded-md flex items-center justify-center flex-shrink-0" style={{ width: 44, height: 60, background: "var(--void)", border: "1px solid var(--line)" }}>
                  <ShieldCheck size={18} color="var(--muted)" />
                </div>
                <div className="text-xs" style={{ color: "var(--muted)" }}>
                  Placeholder — real cert images come from PSA's API response once connected.
                </div>
              </div>

              <div className="text-base font-semibold">{certResult.subject}</div>
              <div className="text-xs mb-3" style={{ color: "var(--muted)" }}>{certResult.year} {certResult.brand} · #{certResult.cardNumber}</div>

              <div className="grid grid-cols-3 gap-2 mb-3">
                <div className="ht-card p-2 text-center" style={{ background: "var(--panel-2)" }}>
                  <div className="text-xs" style={{ color: "var(--muted)" }}>Grade</div>
                  <div className="ht-mono text-lg font-bold" style={{ color: "var(--cyan)" }}>{certResult.grade}</div>
                </div>
                <div className="ht-card p-2 text-center" style={{ background: "var(--panel-2)" }}>
                  <div className="text-xs" style={{ color: "var(--muted)" }}>Label</div>
                  <div className="text-xs font-semibold mt-1.5">{certResult.gradeLabel}</div>
                </div>
                <div className="ht-card p-2 text-center" style={{ background: "var(--panel-2)" }}>
                  <div className="text-xs" style={{ color: "var(--muted)" }}>Pop</div>
                  <div className="ht-mono text-lg font-bold">{certResult.population}</div>
                </div>
              </div>

              <button onClick={addCertToPricer} className="ht-btn-primary rounded-lg py-2.5 text-sm font-semibold w-full flex items-center justify-center gap-2">
                <Tag size={14} /> Add to Price &amp; Label
              </button>
            </div>
          )}
        </div>
      )}

      {/* ---- Tools: Grading Submission Tracker ---- */}
      {tab === "tools" && toolsView === "grading" && (
        <div className="ht-fade px-4 pt-6 pb-6">
          <div className="flex items-center gap-3 mb-4">
            <button onClick={() => setToolsView("menu")}><ArrowLeft size={18} /></button>
            <h1 className="text-lg font-semibold">Grading Submission Tracker</h1>
          </div>

          <div className="ht-card p-4 mb-4">
            <div className="text-xs font-semibold mb-2" style={{ color: "var(--muted)" }}>NEW SUBMISSION</div>
            <input value={gradingForm.cardName} onChange={(e) => setGradingForm(f => ({ ...f, cardName: e.target.value }))} placeholder="Card name" className="ht-input rounded-md px-3 py-2 text-xs w-full mb-2" />
            <div className="flex gap-2 mb-2 flex-wrap">
              <select value={gradingForm.company} onChange={(e) => setGradingForm(f => ({ ...f, company: e.target.value, tier: GRADING_COMPANIES[e.target.value].tiers[0] }))} className="ht-input rounded-md px-2 py-2 text-xs">
                {Object.entries(GRADING_COMPANIES).map(([k, v]) => <option key={k} value={k} style={{ background: "var(--panel-2)" }}>{v.label}</option>)}
              </select>
              <select value={gradingForm.tier} onChange={(e) => setGradingForm(f => ({ ...f, tier: e.target.value }))} className="ht-input rounded-md px-2 py-2 text-xs">
                {GRADING_COMPANIES[gradingForm.company].tiers.map(t => <option key={t} value={t} style={{ background: "var(--panel-2)" }}>{t}</option>)}
              </select>
              <div className="flex items-center gap-1">
                <span className="ht-mono text-xs" style={{ color: "var(--muted)" }}>$</span>
                <input type="number" value={gradingForm.declaredValue} onChange={(e) => setGradingForm(f => ({ ...f, declaredValue: e.target.value }))} placeholder="Declared value" className="ht-input ht-mono rounded-md px-2 py-2 text-xs w-28" />
              </div>
            </div>
            <button onClick={addGradingSub} className="ht-btn-primary rounded-md py-2 text-xs font-semibold w-full flex items-center justify-center gap-1.5"><Plus size={13} /> Add Submission</button>
          </div>

          <SectionHeader title={`In the Pipeline (${gradingSubs.length})`} />
          <div className="px-4 flex flex-col gap-2">
            {gradingSubs.map(s => {
              const co = GRADING_COMPANIES[s.company];
              const statusIdx = GRADING_STATUSES.indexOf(s.status);
              return (
                <div key={s.id} className="ht-card p-3">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold truncate">{s.cardName}</div>
                      <div className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>
                        <span style={{ color: co.color }} className="font-semibold">{co.label}</span> · {s.tier} · Submitted {s.submittedDate}
                      </div>
                    </div>
                    <button onClick={() => removeGradingSub(s.id)}><Trash2 size={14} color="var(--muted)" /></button>
                  </div>
                  <div className="flex items-center gap-1 mb-2">
                    {GRADING_STATUSES.map((st, i) => (
                      <div key={st} className="flex-1 h-1.5 rounded-full" style={{ background: i <= statusIdx ? co.color : "var(--line)" }} title={st} />
                    ))}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold" style={{ color: co.color }}>{s.status}</span>
                    <div className="flex items-center gap-3">
                      <span className="ht-mono text-xs" style={{ color: "var(--muted)" }}>Declared ${s.declaredValue.toFixed(0)}</span>
                      {s.status !== "Complete" && (
                        <button onClick={() => advanceGradingStatus(s.id)} className="text-xs font-semibold" style={{ color: "var(--cyan)" }}>Advance →</button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            {gradingSubs.length === 0 && <p className="text-xs" style={{ color: "var(--muted)" }}>No cards in the grading pipeline yet.</p>}
          </div>
        </div>
      )}

      {/* ---- Tools: Watchlist & Price Alerts ---- */}
      {/* ============ WATCHLIST (top-level tab) ============ */}
      {tab === "watchlist" && (
        <div className="ht-fade px-4 pt-6 pb-6">
          <div className="flex items-center gap-3 mb-4">
            <button onClick={() => setTab("portfolio")}><ArrowLeft size={18} /></button>
            <h1 className="ht-display text-3xl leading-none">WATCHLIST</h1>
          </div>

          <div className="ht-card p-4 mb-4">
            <div className="text-xs font-semibold mb-2" style={{ color: "var(--muted)" }}>ADD TO WATCHLIST</div>
            <input value={watchForm.name} onChange={(e) => setWatchForm(f => ({ ...f, name: e.target.value }))} placeholder="Card name" className="ht-input rounded-md px-3 py-2 text-xs w-full mb-2" />
            <input value={watchForm.set} onChange={(e) => setWatchForm(f => ({ ...f, set: e.target.value }))} placeholder="Set (optional)" className="ht-input rounded-md px-3 py-2 text-xs w-full mb-2" />
            <div className="flex gap-2 flex-wrap">
              <select value={watchForm.direction} onChange={(e) => setWatchForm(f => ({ ...f, direction: e.target.value }))} className="ht-input rounded-md px-2 py-2 text-xs">
                <option value="below" style={{ background: "var(--panel-2)" }}>Alert when price falls below</option>
                <option value="above" style={{ background: "var(--panel-2)" }}>Alert when price rises above</option>
              </select>
              <div className="flex items-center gap-1">
                <span className="ht-mono text-xs" style={{ color: "var(--muted)" }}>$</span>
                <input type="number" value={watchForm.targetPrice} onChange={(e) => setWatchForm(f => ({ ...f, targetPrice: e.target.value }))} placeholder="Target" className="ht-input ht-mono rounded-md px-2 py-2 text-xs w-24" />
              </div>
              <button onClick={addWatch} className="ht-btn-primary rounded-md px-3 py-2 text-xs font-semibold flex items-center gap-1.5"><Plus size={13} /> Add</button>
            </div>
            <p className="text-xs mt-2" style={{ color: "var(--muted)" }}>You can also tap the bell icon on any card or sealed product in Portfolio to add it here instantly.</p>
          </div>

          <SectionHeader title={`Watching (${watchlist.length})`} />
          <div className="px-4 flex flex-col gap-2">
            {watchlistWithPrices.map(w => (
              <div key={w.id} className="ht-card p-3" style={w.triggered ? { borderColor: "var(--green)" } : undefined}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <CatDot category={w.category} />
                      <div className="text-sm font-semibold truncate">{w.name}</div>
                      <span className="ht-chip" style={{ padding: "1px 7px", fontSize: 9, borderColor: w.kind === "sealed" ? "var(--green)" : "var(--cyan)", color: w.kind === "sealed" ? "var(--green)" : "var(--cyan)" }}>
                        {w.kind === "sealed" ? "Sealed" : "Card"}
                      </span>
                    </div>
                    <div className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>{w.set || "—"}</div>
                    <div className="flex items-center gap-1.5 mt-1.5 text-xs">
                      <span>Alert {w.direction === "below" ? "below" : "above"}</span>
                      <span className="ht-mono" style={{ color: "var(--muted)" }}>$</span>
                      <input type="number" value={w.targetPrice} onChange={(e) => updateWatchTarget(w.id, Number(e.target.value) || 0)}
                        className="bg-transparent outline-none ht-mono font-semibold w-16" style={{ color: "var(--text)", borderBottom: "1px dashed var(--line)" }} />
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="ht-mono text-sm font-bold">${w.currentPrice.toFixed(2)}</div>
                    {w.kind === "sealed" ? <span className="text-xs" style={{ color: "var(--muted)" }}>market</span> : <TrendTag pct={w.trendPct} />}
                  </div>
                </div>
                {w.triggered && (
                  <div className="mt-2 pt-2 flex items-center gap-1.5 text-xs font-semibold" style={{ borderTop: "1px solid var(--line)", color: "var(--green)" }}>
                    <Bell size={12} /> Target hit — this {w.kind === "sealed" ? "product" : "card"} is at your alert price
                  </div>
                )}
                <button onClick={() => removeWatch(w.id)} className="text-xs mt-2" style={{ color: "var(--muted)" }}>Remove</button>
              </div>
            ))}
            {watchlist.length === 0 && <p className="text-xs" style={{ color: "var(--muted)" }}>Nothing on your watchlist yet.</p>}
          </div>
        </div>
      )}

      {/* ---- Tools: Tax Export ---- */}
      {tab === "tools" && toolsView === "taxexport" && (
        <div className="ht-fade px-4 pt-6 pb-6">
          <div className="flex items-center gap-3 mb-4">
            <button onClick={() => setToolsView("menu")}><ArrowLeft size={18} /></button>
            <h1 className="text-lg font-semibold">Tax Export</h1>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="ht-card p-3">
              <div className="text-xs" style={{ color: "var(--muted)" }}>Digital Income</div>
              <div className="ht-mono text-xl font-bold mt-1" style={{ color: "var(--cyan)" }}>${digitalRevenue.toFixed(2)}</div>
              <div className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>eBay, TCGplayer, Whatnot, Zelle, Venmo, CashApp, PayPal</div>
            </div>
            <div className="ht-card p-3">
              <div className="text-xs" style={{ color: "var(--muted)" }}>Cash Income</div>
              <div className="ht-mono text-xl font-bold mt-1" style={{ color: "var(--green)" }}>${cashRevenue.toFixed(2)}</div>
              <div className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>In-person, paid cash</div>
            </div>
          </div>

          <div className="ht-card p-4 mb-4">
            <p className="text-xs" style={{ color: "var(--muted)" }}>Total gross revenue <span className="ht-mono font-semibold" style={{ color: "var(--text)" }}>${salesRevenue.toFixed(2)}</span> across {salesLog.length} sales. Digital platforms typically issue a 1099-K above IRS thresholds — cash sales are still reportable income even without a form. This isn't tax advice; check with your accountant on how to file.</p>
          </div>

          <SectionHeader title="Transactions" />
          <div className="px-4 flex flex-col gap-2 mb-3">
            {salesLog.map(r => {
              const digital = isDigitalPayment(r.paymentMethod || (r.platform === "inperson" ? "cash" : "digital"));
              return (
                <div key={r.id} className="ht-card p-3 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold truncate">{r.name}</div>
                    <div className="text-xs" style={{ color: "var(--muted)" }}>{r.date} · {PLATFORM_FEES[r.platform]?.label || r.platform}</div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="ht-mono text-sm font-semibold">${(r.price * r.qty).toFixed(2)}</div>
                    <span className="text-xs font-semibold" style={{ color: digital ? "var(--cyan)" : "var(--green)" }}>{digital ? "Digital" : "Cash"}</span>
                  </div>
                </div>
              );
            })}
            {salesLog.length === 0 && <p className="text-xs" style={{ color: "var(--muted)" }}>No sales logged yet.</p>}
          </div>

          <button onClick={() => {
            const header = "Date,Item,Platform,Payment Type,Amount\n";
            const csvRows = salesLog.map(r => {
              const digital = isDigitalPayment(r.paymentMethod || (r.platform === "inperson" ? "cash" : "digital"));
              return `${r.date},"${r.name.replace(/"/g, '""')}",${PLATFORM_FEES[r.platform]?.label || r.platform},${digital ? "Digital" : "Cash"},${(r.price * r.qty).toFixed(2)}`;
            }).join("\n");
            const blob = new Blob([header + csvRows], { type: "text/csv" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a"); a.href = url; a.download = "holohq_tax_export.csv"; a.click(); URL.revokeObjectURL(url);
          }} className="ht-btn-primary rounded-lg py-2.5 text-sm font-semibold w-full flex items-center justify-center gap-2">
            <Download size={15} /> Export CSV
          </button>
        </div>
      )}

      {/* ---- Tools: Bulk Photo Intake ---- */}
      {tab === "tools" && toolsView === "bulkscan" && (
        <div className="ht-fade px-4 pt-6 pb-6">
          <div className="flex items-center gap-3 mb-4">
            <button onClick={() => setToolsView("menu")}><ArrowLeft size={18} /></button>
            <h1 className="text-lg font-semibold">Bulk Photo Intake</h1>
          </div>

          <input ref={bulkPhotoRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { if (e.target.files.length) runBulkScan(e.target.files); e.target.value = ""; }} />
          <button onClick={() => bulkPhotoRef.current?.click()} disabled={isScanning} className="ht-btn-primary rounded-xl py-6 w-full flex flex-col items-center justify-center gap-2 mb-4">
            {isScanning ? <Loader2 size={22} className="animate-spin" /> : <Camera size={22} />}
            <span className="text-sm font-semibold">{isScanning ? "Scanning…" : "Snap or Upload Card Photos"}</span>
            <span className="text-xs opacity-80">Select multiple at once — one photo per card</span>
          </button>

          {capturedPhotos.length > 0 && (
            <>
              <SectionHeader title={`Scanned (${capturedPhotos.length})`} />
              <div className="px-4 grid grid-cols-3 gap-2 mb-4">
                {capturedPhotos.map(p => (
                  <div key={p.id} className="ht-card p-1.5 relative">
                    <button onClick={() => removeCapturedPhoto(p.id)} className="absolute top-1 right-1 rounded-full flex items-center justify-center z-10" style={{ width: 18, height: 18, background: "rgba(10,7,18,.75)" }}><X size={11} /></button>
                    {p.dataUrl ? <img src={p.dataUrl} alt="" style={{ width: "100%", aspectRatio: "3/4", objectFit: "cover", borderRadius: 6 }} /> : <div style={{ width: "100%", aspectRatio: "3/4", background: "var(--panel-2)", borderRadius: 6 }} />}
                    <div className="mt-1 text-center">
                      {p.status === "scanning" && <span className="text-xs ht-row-forging inline-flex items-center gap-1" style={{ color: "var(--muted)" }}><Loader2 size={10} className="animate-spin" /> Matching</span>}
                      {p.status === "matched" && <span className="text-xs font-semibold truncate block" style={{ color: "var(--green)" }}>{p.card?.name}</span>}
                      {p.status === "matched" && <span className="ht-mono text-xs" style={{ color: "var(--muted)" }}>${p.card?.price.toFixed(2)}</span>}
                    </div>
                  </div>
                ))}
              </div>

              {capturedPhotos.some(p => p.status === "matched") && (
                <div className="px-4">
                  <div className="text-xs font-semibold mb-2" style={{ color: "var(--muted)" }}>ADD MATCHED CARDS TO PORTFOLIO</div>
                  <div className="flex flex-col gap-2">
                    {portfolios.map(pf => (
                      <button key={pf.id} onClick={() => addAllScannedToPortfolio(pf.id)} className="ht-input rounded-md py-2.5 text-xs font-semibold flex items-center justify-between px-3">
                        <span>{pf.name}</span><ChevronRight size={14} color="var(--muted)" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
          {capturedPhotos.length === 0 && <p className="px-4 text-xs" style={{ color: "var(--muted)" }}>Matching runs against a simulated card-ID model — swap in Card Hedge's image recognition API for real matches.</p>}
        </div>
      )}

      {/* ---- Tools: Cross-List Manager ---- */}
      {tab === "tools" && toolsView === "crosslist" && (
        <div className="ht-fade px-4 pt-6 pb-6">
          <div className="flex items-center gap-3 mb-4">
            <button onClick={() => setToolsView("menu")}><ArrowLeft size={18} /></button>
            <h1 className="text-lg font-semibold">Cross-List Manager</h1>
          </div>

          <div className="ht-card p-4 mb-4">
            <div className="text-xs font-semibold mb-2" style={{ color: "var(--muted)" }}>CHOOSE A CARD FROM A PORTFOLIO</div>
            <select value={crossListForm.portfolioId} onChange={(e) => setCrossListForm(f => ({ ...f, portfolioId: e.target.value, rowId: "" }))} className="ht-input rounded-md px-2 py-2 text-xs w-full mb-2">
              <option value="" style={{ background: "var(--panel-2)" }}>Select portfolio…</option>
              {portfolios.map(p => <option key={p.id} value={p.id} style={{ background: "var(--panel-2)" }}>{p.name}</option>)}
            </select>
            {crossListForm.portfolioId && (
              <select value={crossListForm.rowId} onChange={(e) => setCrossListForm(f => ({ ...f, rowId: e.target.value }))} className="ht-input rounded-md px-2 py-2 text-xs w-full mb-3">
                <option value="" style={{ background: "var(--panel-2)" }}>Select card…</option>
                {portfolios.find(p => p.id === crossListForm.portfolioId)?.rows.map(r => (
                  <option key={r.id} value={r.id} style={{ background: "var(--panel-2)" }}>{r.name} — ${r.price?.toFixed(2)}</option>
                ))}
              </select>
            )}
            <div className="text-xs font-semibold mb-2" style={{ color: "var(--muted)" }}>LIST ON</div>
            <div className="flex gap-2 flex-wrap mb-3">
              {CROSSLIST_PLATFORMS.map(pl => (
                <button key={pl.key} onClick={() => toggleCrossListPlatform(pl.key)} className={`ht-chip ${crossListForm.platforms.includes(pl.key) ? "ht-chip-active" : ""}`}>{pl.label}</button>
              ))}
            </div>
            <button onClick={publishCrossListing} disabled={!crossListForm.rowId || crossListForm.platforms.length === 0} className="ht-btn-primary rounded-md py-2 text-xs font-semibold w-full flex items-center justify-center gap-1.5">
              <Repeat size={13} /> Publish Listing
            </button>
          </div>

          <SectionHeader title={`Active Listings (${crossListings.length})`} />
          <div className="px-4 flex flex-col gap-2">
            {crossListings.map(l => (
              <div key={l.id} className="ht-card p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold truncate">{l.cardName}</div>
                    <div className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>{l.set} · Listed {l.listedAt}</div>
                    <div className="flex gap-1.5 flex-wrap mt-1.5">
                      {l.platforms.map(pk => <span key={pk} className="ht-chip" style={{ padding: "1px 8px", fontSize: 10 }}>{CROSSLIST_PLATFORMS.find(p => p.key === pk)?.label}</span>)}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="ht-mono text-sm font-semibold">${l.price?.toFixed(2)}</div>
                    <button onClick={() => removeCrossListing(l.id)} className="text-xs mt-1" style={{ color: "var(--muted)" }}>Unlist</button>
                  </div>
                </div>
              </div>
            ))}
            {crossListings.length === 0 && <p className="text-xs" style={{ color: "var(--muted)" }}>Nothing cross-listed yet.</p>}
          </div>
          <p className="px-0 mt-3 text-xs" style={{ color: "var(--muted)" }}>Publishing here is simulated — a production build authenticates with each platform's API and creates the real listing.</p>
        </div>
      )}

      {/* ---- Tools: Auto Repricing ---- */}
      {tab === "tools" && toolsView === "repricing" && (
        <div className="ht-fade px-4 pt-6 pb-6">
          <div className="flex items-center gap-3 mb-4">
            <button onClick={() => setToolsView("menu")}><ArrowLeft size={18} /></button>
            <h1 className="text-lg font-semibold">Auto Repricing</h1>
          </div>

          <div className="ht-card p-4 mb-4">
            <div className="text-xs font-semibold mb-2" style={{ color: "var(--muted)" }}>NEW RULE</div>
            <select value={repricingForm.portfolioId} onChange={(e) => setRepricingForm(f => ({ ...f, portfolioId: e.target.value }))} className="ht-input rounded-md px-2 py-2 text-xs w-full mb-2">
              <option value="" style={{ background: "var(--panel-2)" }}>Select portfolio…</option>
              {portfolios.map(p => <option key={p.id} value={p.id} style={{ background: "var(--panel-2)" }}>{p.name}</option>)}
            </select>
            <div className="flex gap-2 flex-wrap">
              <select value={repricingForm.mode} onChange={(e) => setRepricingForm(f => ({ ...f, mode: e.target.value }))} className="ht-input rounded-md px-2 py-2 text-xs">
                <option value="undercut" style={{ background: "var(--panel-2)" }}>Undercut market by</option>
                <option value="match" style={{ background: "var(--panel-2)" }}>Match market exactly</option>
                <option value="premium" style={{ background: "var(--panel-2)" }}>Price above market by</option>
              </select>
              {repricingForm.mode !== "match" && (
                <div className="flex items-center gap-1">
                  <input type="number" value={repricingForm.adjustPct} onChange={(e) => setRepricingForm(f => ({ ...f, adjustPct: e.target.value }))} className="ht-input ht-mono rounded-md px-2 py-2 text-xs w-16" />
                  <span className="ht-mono text-xs" style={{ color: "var(--muted)" }}>%</span>
                </div>
              )}
              <button onClick={addRepricingRule} className="ht-btn-primary rounded-md px-3 py-2 text-xs font-semibold flex items-center gap-1.5"><Plus size={13} /> Add Rule</button>
            </div>
          </div>

          <SectionHeader title={`Rules (${repricingRules.length})`} />
          <div className="px-4 flex flex-col gap-2">
            {repricingRules.map(rule => {
              const portfolio = portfolios.find(p => p.id === rule.portfolioId);
              const preview = portfolio?.rows.slice(0, 3) || [];
              return (
                <div key={rule.id} className="ht-card p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold truncate">{portfolio?.name || "Deleted portfolio"}</div>
                      <div className="text-xs" style={{ color: "var(--muted)" }}>
                        {rule.mode === "match" ? "Match market exactly" : rule.mode === "undercut" ? `Undercut market by ${rule.adjustPct}%` : `Price above market by ${rule.adjustPct}%`}
                      </div>
                    </div>
                    <button onClick={() => toggleRepricingRule(rule.id)} className="rounded-full flex-shrink-0" style={{ width: 40, height: 22, background: rule.enabled ? "var(--green)" : "var(--panel-2)", border: "1px solid var(--line)", position: "relative" }}>
                      <span style={{ position: "absolute", top: 1, left: rule.enabled ? 19 : 1, width: 18, height: 18, borderRadius: "50%", background: "#fff", transition: "left .15s" }} />
                    </button>
                  </div>
                  {rule.enabled && preview.length > 0 && (
                    <div className="pt-2 mb-2" style={{ borderTop: "1px solid var(--line)" }}>
                      {preview.map(r => (
                        <div key={r.id} className="flex items-center justify-between text-xs py-0.5">
                          <span className="truncate" style={{ color: "var(--muted)" }}>{r.name}</span>
                          <span className="ht-mono flex-shrink-0 ml-2">${r.price?.toFixed(2)} → ${suggestedPrice(r.price || 0, rule).toFixed(2)}</span>
                        </div>
                      ))}
                      {portfolio.rows.length > 3 && <div className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>+{portfolio.rows.length - 3} more</div>}
                    </div>
                  )}
                  <div className="flex items-center gap-3">
                    <button onClick={() => applyRepricing(rule)} disabled={!rule.enabled} className="ht-btn-primary rounded-md px-3 py-1.5 text-xs font-semibold">Apply Now</button>
                    <button onClick={() => removeRepricingRule(rule.id)} className="text-xs" style={{ color: "var(--muted)" }}>Delete Rule</button>
                  </div>
                </div>
              );
            })}
            {repricingRules.length === 0 && <p className="text-xs" style={{ color: "var(--muted)" }}>No repricing rules yet.</p>}
          </div>
          <p className="px-0 mt-3 text-xs" style={{ color: "var(--muted)" }}>"Apply Now" updates prices immediately based on current simulated market data — this doesn't run automatically in the background yet.</p>
        </div>
      )}

      {/* ---- Tools: AI Grade Prediction ---- */}
      {tab === "tools" && toolsView === "gradepredict" && (
        <div className="ht-fade px-4 pt-6 pb-6">
          <div className="flex items-center gap-3 mb-4">
            <button onClick={() => setToolsView("menu")}><ArrowLeft size={18} /></button>
            <h1 className="text-lg font-semibold">AI Grade Prediction</h1>
          </div>

          <div className="ht-card p-4 mb-3">
            <div className="text-xs font-semibold mb-2" style={{ color: "var(--muted)" }}>CARD (optional — improves value estimates)</div>
            <input value={gradePredictForm.name} onChange={(e) => setGradePredictForm(f => ({ ...f, name: e.target.value }))} placeholder="Card name" className="ht-input rounded-md px-3 py-2 text-xs w-full mb-2" />
            <input value={gradePredictForm.set} onChange={(e) => setGradePredictForm(f => ({ ...f, set: e.target.value }))} placeholder="Set" className="ht-input rounded-md px-3 py-2 text-xs w-full" />
          </div>

          <input ref={gradePredictPhotoRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { if (e.target.files[0]) runGradePrediction(e.target.files[0]); e.target.value = ""; }} />
          {!gradePredictPhoto ? (
            <button onClick={() => gradePredictPhotoRef.current?.click()} className="ht-btn-primary rounded-xl py-6 w-full flex flex-col items-center justify-center gap-2 mb-4">
              <Sparkles size={22} />
              <span className="text-sm font-semibold">Take or Upload a Card Photo</span>
              <span className="text-xs opacity-80">Raw card, front, well-lit &amp; in focus</span>
            </button>
          ) : (
            <div className="ht-card p-3 mb-4">
              <img src={gradePredictPhoto} alt="" style={{ width: "100%", maxHeight: 220, objectFit: "contain", borderRadius: 8 }} />
              <button onClick={() => { setGradePredictPhoto(null); setGradePredictResult(null); }} className="text-xs mt-2" style={{ color: "var(--muted)" }}>Remove photo</button>
            </div>
          )}

          {isPredictingGrade && (
            <div className="ht-card p-4 flex items-center gap-2 mb-4 ht-row-forging">
              <Loader2 size={15} className="animate-spin" /> <span className="text-xs">Predicting grade outcome across PSA standards…</span>
            </div>
          )}

          {gradePredictResult && (
            <div className="ht-fade">
              <div className="ht-card p-4 mb-3">
                <div className="text-xs" style={{ color: "var(--muted)" }}>Most Likely Outcome</div>
                <div className="text-lg font-semibold mt-1">{gradePredictResult.predicted}</div>
                <div className="text-xs mt-1 mb-3" style={{ color: "var(--muted)" }}>{gradePredictResult.confidence}% model confidence</div>
                {Object.entries(gradePredictResult.probs).map(([grade, pct]) => (
                  <div key={grade} className="mb-2">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span>{grade}</span>
                      <span className="ht-mono font-semibold">{pct}%</span>
                    </div>
                    <div className="rounded-full h-1.5 overflow-hidden" style={{ background: "var(--panel-2)" }}>
                      <div style={{ width: `${pct}%`, height: "100%", background: "linear-gradient(90deg, var(--purple), var(--cyan))" }} />
                    </div>
                  </div>
                ))}
              </div>

              <div className="ht-card p-4" style={{ borderColor: gradePredictResult.roi >= 0 ? "var(--green)" : "var(--red)" }}>
                <div className="text-sm font-semibold mb-2">{gradePredictResult.roi >= 0 ? "Worth grading ✓" : "Probably not worth grading"}</div>
                <div className="flex flex-col gap-1 text-xs" style={{ color: "var(--muted)" }}>
                  <div className="flex justify-between"><span>Raw value now</span><span className="ht-mono" style={{ color: "var(--text)" }}>${gradePredictResult.rawValue.toFixed(2)}</span></div>
                  <div className="flex justify-between"><span>Value if PSA 10</span><span className="ht-mono" style={{ color: "var(--text)" }}>${gradePredictResult.psa10Value.toFixed(2)}</span></div>
                  <div className="flex justify-between"><span>Value if PSA 9</span><span className="ht-mono" style={{ color: "var(--text)" }}>${gradePredictResult.psa9Value.toFixed(2)}</span></div>
                  <div className="flex justify-between"><span>Est. grading cost</span><span className="ht-mono" style={{ color: "var(--text)" }}>-${gradePredictResult.gradingCost.toFixed(2)}</span></div>
                  <div className="flex justify-between pt-1.5 mt-1" style={{ borderTop: "1px solid var(--line)" }}>
                    <span className="font-semibold" style={{ color: "var(--text)" }}>Expected gain vs selling raw</span>
                    <span className="ht-mono font-bold" style={{ color: gradePredictResult.roi >= 0 ? "var(--green)" : "var(--red)" }}>
                      {gradePredictResult.roi >= 0 ? "+" : "-"}${Math.abs(gradePredictResult.roi).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
              <p className="mt-3 text-xs" style={{ color: "var(--muted)" }}>Prediction is simulated from the photo file, not real computer vision — a production build needs a trained grading model (or Card Hedge's grade-prediction API).</p>
            </div>
          )}
        </div>
      )}

      {/* ---- Tools: Condition Checker ---- */}
      {tab === "tools" && toolsView === "condition" && (
        <div className="ht-fade px-4 pt-6 pb-6">
          <div className="flex items-center gap-3 mb-4">
            <button onClick={() => setToolsView("menu")}><ArrowLeft size={18} /></button>
            <h1 className="text-lg font-semibold">Condition Checker</h1>
          </div>

          <input ref={conditionPhotoRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { if (e.target.files[0]) runConditionCheck(e.target.files[0]); e.target.value = ""; }} />
          {!conditionPhoto ? (
            <button onClick={() => conditionPhotoRef.current?.click()} className="ht-btn-primary rounded-xl py-6 w-full flex flex-col items-center justify-center gap-2 mb-4">
              <Camera size={22} />
              <span className="text-sm font-semibold">Take or Upload a Card Photo</span>
              <span className="text-xs opacity-80">Front, well-lit, flat on a surface</span>
            </button>
          ) : (
            <div className="ht-card p-3 mb-4">
              <img src={conditionPhoto} alt="" style={{ width: "100%", maxHeight: 220, objectFit: "contain", borderRadius: 8 }} />
              <button onClick={() => { setConditionPhoto(null); setConditionResult(null); }} className="text-xs mt-2" style={{ color: "var(--muted)" }}>Remove photo</button>
            </div>
          )}

          {isCheckingCondition && (
            <div className="ht-card p-4 flex items-center gap-2 mb-4 ht-row-forging">
              <Loader2 size={15} className="animate-spin" /> <span className="text-xs">Analyzing centering, corners, edges &amp; surface…</span>
            </div>
          )}

          {conditionResult && (
            <div className="ht-card p-4 mb-4 ht-fade">
              <div className="text-xs" style={{ color: "var(--muted)" }}>AI Condition Estimate</div>
              <div className="text-lg font-semibold mt-1">{conditionResult.gradeEstimate}</div>
              <div className="text-xs mt-1" style={{ color: "var(--muted)" }}>{conditionResult.confidence}% confidence</div>
              <div className="grid grid-cols-4 gap-2 mt-3">
                {[["Centering", conditionResult.centering], ["Corners", conditionResult.corners], ["Edges", conditionResult.edges], ["Surface", conditionResult.surface]].map(([label, val]) => (
                  <div key={label} className="text-center">
                    <div className="ht-mono text-sm font-bold">{val}/10</div>
                    <div className="text-xs" style={{ color: "var(--muted)" }}>{label}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <SectionHeader title="Condition Examples" />
          <div className="px-4 flex flex-col gap-2">
            {CONDITION_EXAMPLES.map(c => (
              <div key={c.key} className="ht-card p-3 flex gap-3">
                <div className="rounded-lg flex-shrink-0 flex items-center justify-center ht-mono text-xs font-bold" style={{ width: 40, height: 40, background: "var(--panel-2)", color: c.color, border: `1px solid ${c.color}` }}>{c.key}</div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold">{c.label}</div>
                  <div className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>{c.desc}</div>
                </div>
              </div>
            ))}
          </div>
          <p className="px-4 mt-3 text-xs" style={{ color: "var(--muted)" }}>Grade estimate is simulated from the photo file, not real computer vision — a production build needs a trained grading model.</p>
        </div>
      )}

      {/* ---- Tools: Insurance / Appraisal Report ---- */}
      {tab === "tools" && toolsView === "insurance" && (() => {
        const allSealedItems = sealedPortfolios.flatMap(sp => sp.items.map(i => ({ ...i, portfolioName: sp.name })));
        const cardsValue = allRows.reduce((s, r) => s + (r.price || 0) * r.qty, 0);
        const sealedValue = allSealedItems.reduce((s, i) => s + i.marketEach * i.qty, 0);
        return (
          <div className="ht-fade px-4 pt-6 pb-6">
            <div className="flex items-center gap-3 mb-4 no-print">
              <button onClick={() => setToolsView("menu")}><ArrowLeft size={18} /></button>
              <h1 className="text-lg font-semibold">Insurance / Appraisal Report</h1>
            </div>

            <div className="ht-card p-4 mb-4">
              <p className="text-xs" style={{ color: "var(--muted)" }}>Report Date</p>
              <p className="text-sm font-semibold">{new Date().toLocaleDateString()}</p>
              <div className="mt-3 pt-3 flex items-center justify-between" style={{ borderTop: "1px solid var(--line)" }}>
                <span className="text-sm font-semibold">Total Appraised Value</span>
                <span className="ht-mono text-xl font-bold" style={{ color: "var(--cyan)" }}>${(cardsValue + sealedValue).toFixed(2)}</span>
              </div>
              <div className="flex gap-4 mt-2 text-xs" style={{ color: "var(--muted)" }}>
                <span>Cards ${cardsValue.toFixed(2)}</span>
                <span>Sealed ${sealedValue.toFixed(2)}</span>
              </div>
            </div>

            <SectionHeader title="Cards" />
            <div className="px-4 flex flex-col gap-1.5 mb-4">
              {allRows.map(r => (
                <div key={r.id} className="ht-card p-2.5 flex items-center justify-between">
                  <div className="min-w-0">
                    <div className="text-xs font-semibold truncate">{r.name}</div>
                    <div className="text-xs" style={{ color: "var(--muted)" }}>{r.set} · {r.condition} · qty {r.qty} · {r.portfolioName}</div>
                  </div>
                  <span className="ht-mono text-xs font-semibold flex-shrink-0">${((r.price || 0) * r.qty).toFixed(2)}</span>
                </div>
              ))}
              {allRows.length === 0 && <p className="text-xs" style={{ color: "var(--muted)" }}>No cards on file.</p>}
            </div>

            <SectionHeader title="Sealed Product" />
            <div className="px-4 flex flex-col gap-1.5 mb-4">
              {allSealedItems.map(i => (
                <div key={i.id} className="ht-card p-2.5 flex items-center justify-between">
                  <div className="min-w-0">
                    <div className="text-xs font-semibold truncate">{i.productName}</div>
                    <div className="text-xs" style={{ color: "var(--muted)" }}>qty {i.qty} · {i.portfolioName}</div>
                  </div>
                  <span className="ht-mono text-xs font-semibold flex-shrink-0">${(i.marketEach * i.qty).toFixed(2)}</span>
                </div>
              ))}
              {allSealedItems.length === 0 && <p className="text-xs" style={{ color: "var(--muted)" }}>No sealed product on file.</p>}
            </div>

            <button onClick={() => window.print()} className="ht-btn-primary rounded-lg py-2.5 text-sm font-semibold w-full flex items-center justify-center gap-2 no-print">
              <Printer size={15} /> Print / Save as PDF
            </button>
            <p className="px-0 mt-3 text-xs no-print" style={{ color: "var(--muted)" }}>Values are current simulated market prices, not a substitute for a certified appraisal.</p>
          </div>
        );
      })()}

      {/* ---- Tools: Full Backup & Restore ---- */}
      {tab === "tools" && toolsView === "backup" && (
        <div className="ht-fade px-4 pt-6 pb-6">
          <div className="flex items-center gap-3 mb-4">
            <button onClick={() => setToolsView("menu")}><ArrowLeft size={18} /></button>
            <h1 className="text-lg font-semibold">Full Backup &amp; Restore</h1>
          </div>

          <div className="ht-card p-4 mb-3">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: syncStatus === "synced" ? "var(--green)" : syncStatus === "error" ? "var(--red)" : "var(--amber)" }} />
              <span className="text-xs font-semibold">
                {syncStatus === "synced" ? "Synced — up to date across your devices" : syncStatus === "syncing" ? "Syncing…" : syncStatus === "error" ? "Sync failed — data is only saved on this device" : "Loading…"}
              </span>
            </div>
            <p className="text-xs" style={{ color: "var(--muted)" }}>Everything in HoloHQ auto-saves as you go and picks back up wherever you open the app next, on any device signed into this account.</p>
          </div>

          <div className="ht-card p-4 mb-3">
            <div className="text-sm font-semibold mb-1">Export Backup</div>
            <p className="text-xs mb-3" style={{ color: "var(--muted)" }}>Downloads every portfolio, sealed item, sale, expense, grading submission, want list entry, and setting as one JSON file.</p>
            <button onClick={exportFullBackup} className="ht-btn-primary rounded-md py-2.5 text-xs font-semibold w-full flex items-center justify-center gap-1.5"><Download size={14} /> Download Backup (.json)</button>
          </div>

          <div className="ht-card p-4">
            <div className="text-sm font-semibold mb-1">Restore from Backup</div>
            <p className="text-xs mb-3" style={{ color: "var(--muted)" }}>Replaces current data with what's in the backup file. This can't be undone.</p>
            <input ref={backupFileRef} type="file" accept="application/json" className="hidden" onChange={(e) => { if (e.target.files[0]) importFullBackup(e.target.files[0]); e.target.value = ""; }} />
            <button onClick={() => backupFileRef.current?.click()} className="ht-input rounded-md py-2.5 text-xs font-semibold w-full flex items-center justify-center gap-1.5"><Upload size={14} /> Choose Backup File</button>
            {restoreMessage && <p className="text-xs mt-2 ht-fade" style={{ color: restoreMessage.includes("Couldn't") ? "var(--red)" : "var(--green)" }}>{restoreMessage}</p>}
          </div>
        </div>
      )}

      {/* ---- Tools: Calculator ---- */}
      {tab === "tools" && toolsView === "calculator" && (
        <div className="ht-fade px-4 pt-6 pb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <button onClick={() => setToolsView("menu")}><ArrowLeft size={18} /></button>
              <h1 className="text-lg font-semibold">Calculator</h1>
            </div>
            {calcTape.length > 0 && <button onClick={clearTape} className="text-xs" style={{ color: "var(--red)" }}>Clear all</button>}
          </div>

          {/* running total display */}
          <div className="ht-card p-4 mb-3" style={{ borderColor: "var(--cyan)" }}>
            <div className="text-xs" style={{ color: "var(--muted)" }}>Running Total ({calcTape.length} {calcTape.length === 1 ? "card" : "cards"})</div>
            <div className="ht-mono text-3xl font-bold" style={{ color: "var(--cyan)" }}>${calcTotal.toFixed(2)}</div>
          </div>

          {/* tape of added cards */}
          {calcTape.length > 0 && (
            <div className="ht-card p-3 mb-3 max-h-32 overflow-y-auto ht-scroll">
              {calcTape.map((t, i) => (
                <div key={t.id} className="flex items-center justify-between py-1" style={{ borderBottom: i < calcTape.length - 1 ? "1px solid var(--line)" : "none" }}>
                  <span className="text-xs" style={{ color: "var(--muted)" }}>#{i + 1}</span>
                  <span className="ht-mono text-sm">${t.value.toFixed(2)}</span>
                  <button onClick={() => removeTapeItem(t.id)}><X size={13} color="var(--muted)" /></button>
                </div>
              ))}
            </div>
          )}

          {/* entry display */}
          <div className="ht-card p-4 mb-3 text-right">
            <div className="ht-mono text-3xl font-bold" style={{ color: calcEntry ? "var(--text)" : "var(--muted)" }}>
              ${calcEntry || "0"}
            </div>
          </div>

          {/* keypad */}
          <div className="grid grid-cols-4 gap-2 mb-3">
            {["7", "8", "9", "⌫"].map(k => (
              <button key={k} onClick={() => (k === "⌫" ? backspace() : pressDigit(k))} className="ht-input rounded-lg py-3 text-lg font-semibold ht-mono">{k}</button>
            ))}
            {["4", "5", "6", "C"].map(k => (
              <button key={k} onClick={() => (k === "C" ? clearEntry() : pressDigit(k))} className="ht-input rounded-lg py-3 text-lg font-semibold ht-mono">{k}</button>
            ))}
            {["1", "2", "3"].map(k => (
              <button key={k} onClick={() => pressDigit(k)} className="ht-input rounded-lg py-3 text-lg font-semibold ht-mono">{k}</button>
            ))}
            <button onClick={addToTape} className="ht-btn-primary rounded-lg py-3 text-sm font-semibold row-span-2 flex items-center justify-center"><Plus size={20} /></button>
            {[".", "0"].map(k => (
              <button key={k} onClick={() => pressDigit(k)} className="ht-input rounded-lg py-3 text-lg font-semibold ht-mono">{k}</button>
            ))}
          </div>

          {/* percentage breakdown of the running total */}
          <SectionHeader title="Percent of Total" />
          <div className="grid grid-cols-3 gap-2 px-0">
            {PERCENTS.map(p => (
              <div key={p} className="ht-card p-3 text-center">
                <div className="text-xs" style={{ color: "var(--muted)" }}>{p}%</div>
                <div className="ht-mono text-sm font-semibold mt-0.5">${((calcTotal * p) / 100).toFixed(2)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ---- Tools: Trade Analyzer ---- */}
      {tab === "tools" && toolsView === "trade" && (
        <div className="ht-fade px-4 pt-6 pb-6">
          <div className="flex items-center gap-3 mb-4">
            <button onClick={() => setToolsView("menu")}><ArrowLeft size={18} /></button>
            <h1 className="text-lg font-semibold">Trade Analyzer</h1>
          </div>

          {[{ side: "give", label: "You're Giving", list: tradeGive, total: giveTotal, accent: "var(--red)" },
            { side: "get", label: "You're Getting", list: tradeGet, total: getTotal, accent: "var(--green)" }].map(col => (
            <div key={col.side} className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold">{col.label}</span>
                <button onClick={() => addTradeCard(col.side)} className="ht-input rounded-md px-2 py-1 text-xs flex items-center gap-1"><Plus size={12} /> Add</button>
              </div>
              <div className="flex flex-col gap-2">
                {col.list.map(r => (
                  <div key={r.id} className="ht-card p-3">
                    <div className="flex items-center gap-2">
                      <input value={r.name} onChange={(e) => updateTradeCard(col.side, r.id, { name: e.target.value })} placeholder="Card name"
                        className="bg-transparent outline-none text-sm flex-1 min-w-0" style={{ color: "var(--text)" }} />
                      <button onClick={() => removeTradeCard(col.side, r.id)}><Trash2 size={13} color="var(--muted)" /></button>
                    </div>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <select value={r.condition} onChange={(e) => updateTradeCard(col.side, r.id, { condition: e.target.value })} className="bg-transparent outline-none text-xs ht-mono" style={{ color: "var(--cyan)" }}>
                        {CONDITIONS.map(c => <option key={c} value={c} style={{ background: "var(--panel-2)" }}>{c}</option>)}
                      </select>
                      <button onClick={() => lookupTradeCard(col.side, r.id)} className="text-xs" style={{ color: "var(--purple)" }}>Estimate</button>
                      <div className="flex items-center gap-1 ml-auto">
                        <span className="ht-mono text-xs" style={{ color: "var(--muted)" }}>$</span>
                        <input type="number" value={r.price} onChange={(e) => updateTradeCard(col.side, r.id, { price: Number(e.target.value) || 0 })}
                          className="bg-transparent outline-none ht-mono text-sm w-16 font-semibold" />
                      </div>
                    </div>
                  </div>
                ))}
                {col.list.length === 0 && <p className="text-xs" style={{ color: "var(--muted)" }}>No cards added yet.</p>}
              </div>
              <div className="text-right mt-1 ht-mono text-sm font-semibold" style={{ color: col.accent }}>${col.total.toFixed(2)}</div>
            </div>
          ))}

          <div className="ht-card p-4" style={{ borderColor: tradeVerdict === "fair" ? "var(--muted)" : tradeVerdict === "win" ? "var(--green)" : "var(--red)" }}>
            <div className="text-xs mb-1" style={{ color: "var(--muted)" }}>Verdict</div>
            <div className="ht-mono text-2xl font-bold" style={{ color: tradeVerdict === "fair" ? "var(--text)" : tradeVerdict === "win" ? "var(--green)" : "var(--red)" }}>
              {tradeVerdict === "fair" ? "Fair Trade" : tradeVerdict === "win" ? `+$${tradeDiff.toFixed(2)} in your favor` : `-$${Math.abs(tradeDiff).toFixed(2)} against you`}
            </div>
            <div className="text-xs mt-1" style={{ color: "var(--muted)" }}>
              Giving ${giveTotal.toFixed(2)} · Getting ${getTotal.toFixed(2)} · {tradePctDiff >= 0 ? "+" : ""}{tradePctDiff.toFixed(1)}%
            </div>
          </div>
        </div>
      )}

      {/* ============ SEARCH ============ */}
      {tab === "search" && (
        <div className="ht-fade px-4 pt-6 pb-6">
          <h1 className="ht-display text-3xl leading-none mb-1">SEARCH</h1>
          <p className="text-xs mb-4" style={{ color: "var(--muted)" }}>
            Live Pokémon TCG catalog · sealed products · or enter a PSA cert number
          </p>

          <div className="relative mb-3">
            <input value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); if (!e.target.value.trim()) { setSearchFullView(false); } }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && searchQuery.trim()) {
                  // If all digits → treat as PSA cert number
                  if (/^\d{5,10}$/.test(searchQuery.trim())) {
                    setCertInput(searchQuery.trim());
                    setTab("tools");
                    setToolsView("psa");
                    setTimeout(() => runCertLookup(), 100);
                  } else {
                    setSearchFullView(true);
                  }
                  e.target.blur();
                }
              }}
              placeholder="Search cards or enter a PSA cert number..." className="ht-input rounded-lg px-3 py-3 text-sm w-full" />

            {/* quick popup — only while typing, before Enter */}
            {!searchFullView && searchQuery.trim() && (
              <div className="ht-card ht-fade" style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 20, maxHeight: 360, overflowY: "auto", padding: 6 }}>
                {quickSearchResults.length === 0 && (
                  <p className="text-xs text-center py-4" style={{ color: "var(--muted)" }}>No matches. Try a different name or enter a custom card.</p>
                )}
                {quickSearchResults.map((item, i) => (
                  <div key={i} onClick={() => openSearchResult(item)} className="rounded-md px-2 py-2 flex items-center gap-2.5" style={{ cursor: "pointer" }}>
                    <div style={{ flexShrink: 0, width: 32, height: 44, borderRadius: 4, overflow: "hidden" }}>
                      <CardImage name={item.name} set={item.set} imageUrl={item.image || null} sealedName={item.kind === "sealed" ? item.productName : undefined} height={44} style={{ borderRadius: 4 }} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">{item.kind === "sealed" ? item.productName : (item.displayName || item.name)}</div>
                      <div className="text-xs truncate" style={{ color: "var(--muted)" }}>{item.kind === "sealed" ? "Sealed" : item.set}{item.rarity ? ` · ${item.rarity}` : ""}</div>
                    </div>
                    <span className="ht-mono text-xs font-semibold flex-shrink-0">${(item.price || 0).toFixed(2)}</span>
                  </div>
                ))}
                {searchQuery.trim() && (
                  <button onClick={() => setSearchFullView(true)} className="w-full text-center text-xs font-semibold py-2 mt-1" style={{ color: "var(--cyan)" }}>
                    See all results for "{searchQuery.trim()}" →
                  </button>
                )}
              </div>
            )}
          </div>

          {!searchQuery.trim() && !searchFullView && (
            <div>
              {recentSearches.length > 0 ? (
                <>
                  <SectionHeader title="Recently Searched" />
                  <div className="px-4 flex flex-col gap-2">
                    {recentSearches.map((item, i) => (
                      <div key={i} onClick={() => openSearchResult(item)} className="ht-card p-3 flex items-center gap-3" style={{ cursor: "pointer" }}>
                        <div style={{ flexShrink: 0, width: 30, height: 42, borderRadius: 4, overflow: "hidden" }}>
                          <CardImage name={item.name} set={item.set} imageUrl={item.image || null} sealedName={item.kind === "sealed" ? item.productName : undefined} height={42} style={{ borderRadius: 4 }} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium truncate">{item.kind === "sealed" ? item.productName : (item.displayName || item.name)}</div>
                          <div className="text-xs truncate" style={{ color: "var(--muted)" }}>{item.kind === "sealed" ? "Sealed product" : item.set}{item.rarity ? ` · ${item.rarity}` : ""}</div>
                        </div>
                        <button onClick={(e) => { e.stopPropagation(); removeRecentSearch(item); }}><X size={13} color="var(--muted)" /></button>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center text-center" style={{ paddingTop: 60 }}>
                  <Search size={26} color="var(--muted)" />
                  <p className="text-xs mt-3 max-w-[220px]" style={{ color: "var(--muted)" }}>Try "Charizard" or "Booster Box", then hit enter to browse everything.</p>
                </div>
              )}
            </div>
          )}

          {/* full search results page — shown after Enter */}
          {searchFullView && (
            <div className="ht-fade">
              <div className="flex items-center gap-3 mb-3">
                <button onClick={() => setSearchFullView(false)}><ArrowLeft size={18} /></button>
                <span className="text-sm font-semibold">{fullSearchResults.length} result{fullSearchResults.length === 1 ? "" : "s"}</span>
              </div>

              <div className="flex gap-2 mb-2 overflow-x-auto ht-scroll">
                <button onClick={() => setSearchCategoryFilter("all")} className={`ht-chip flex-shrink-0 ${searchCategoryFilter === "all" ? "ht-chip-active" : ""}`}>All</button>
                {CATEGORIES.map(c => (
                  <button key={c.key} onClick={() => setSearchCategoryFilter(c.key)} className={`ht-chip flex-shrink-0 ${searchCategoryFilter === c.key ? "ht-chip-active" : ""}`}>{c.label}</button>
                ))}
              </div>
              <select value={searchSort} onChange={(e) => setSearchSort(e.target.value)} className="ht-input rounded-md px-2 py-2 text-xs mb-3">
                <option value="popularity" style={{ background: "var(--panel-2)" }}>Sort: Best Sellers</option>
                <option value="priceHigh" style={{ background: "var(--panel-2)" }}>Sort: Price High → Low</option>
                <option value="priceLow" style={{ background: "var(--panel-2)" }}>Sort: Price Low → High</option>
                <option value="name" style={{ background: "var(--panel-2)" }}>Sort: Name A → Z</option>
              </select>

              <div className="flex flex-col gap-2">
                {fullSearchResults.map((item, i) => (
                  <div key={i} onClick={() => openSearchResult(item)} className="ht-card p-3 flex items-center gap-3" style={{ cursor: "pointer" }}>
                    <div style={{ flexShrink: 0, width: 40, height: 56, borderRadius: 6, overflow: "hidden" }}>
                      <CardImage name={item.name} set={item.set} imageUrl={item.image || null} sealedName={item.kind === "sealed" ? item.productName : undefined} height={56} style={{ borderRadius: 6 }} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">{item.kind === "sealed" ? item.productName : (item.displayName || item.name)}</div>
                      <div className="text-xs truncate" style={{ color: "var(--muted)" }}>{item.kind === "sealed" ? "Sealed product" : item.set}</div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <span className="ht-mono text-sm font-semibold">${(item.price || 0).toFixed(2)}</span>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); item.kind === "sealed" ? toggleSealedWatch(item) : toggleCardWatch(item); }}
                      className="rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0"
                      style={{ background: (item.kind === "sealed" ? isSealedWatched(item) : isCardWatched(item)) ? "var(--cyan)" : "var(--panel-2)", border: "1px solid var(--line)" }}>
                      <Bell size={11} color={(item.kind === "sealed" ? isSealedWatched(item) : isCardWatched(item)) ? "#0A0912" : "var(--muted)"} />
                    </button>
                  </div>
                ))}
                {fullSearchResults.length === 0 && (
                  <div className="text-center py-8">
                    <p className="text-xs mb-3" style={{ color: "var(--muted)" }}>No results for "{searchQuery}" in the live catalog.</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============ EXPLORE (flattened — everything on one page) ============ */}
      {tab === "explore" && (
        <div className="ht-fade px-4 pt-6 pb-6">
          <h1 className="ht-display text-3xl leading-none mb-4">EXPLORE</h1>

          <div className="flex items-center justify-between px-4 mb-2">
            <h2 className="text-sm font-semibold" style={{ letterSpacing: "0.02em" }}>Trending</h2>
            <div className="flex rounded-full p-0.5" style={{ background: "var(--panel-2)" }}>
              <button onClick={() => { setExploreTrendSection("cards"); setExploreTrendingPage(0); }} className="px-3 py-1 rounded-full text-xs font-semibold"
                style={{ background: exploreTrendSection === "cards" ? "var(--purple)" : "transparent", color: exploreTrendSection === "cards" ? "#fff" : "var(--muted)" }}>
                Cards
              </button>
              <button onClick={() => { setExploreTrendSection("sealed"); setExploreTrendingPage(0); }} className="px-3 py-1 rounded-full text-xs font-semibold"
                style={{ background: exploreTrendSection === "sealed" ? "var(--purple)" : "transparent", color: exploreTrendSection === "sealed" ? "#fff" : "var(--muted)" }}>
                Sealed
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2 px-4 mb-2 text-xs" style={{ color: "var(--muted)" }}>
            <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: "var(--amber)" }} />
            Simulated — real version pulls sold-listing volume from eBay/TCGplayer/Alt
          </div>
          {(() => {
            const perPage = 5;
            const sorted = exploreTrendSection === "cards"
              ? [...MARKET_MOVERS].sort((a, b) => b.comps - a.comps)
              : [...SEALED_TRENDING].sort((a, b) => b.changePct - a.changePct);
            const totalPages = Math.max(1, Math.ceil(sorted.length / perPage));
            const page = Math.min(exploreTrendingPage, totalPages - 1);
            const slice = sorted.slice(page * perPage, page * perPage + perPage);
            return (
              <>
                <div className="px-4 flex flex-col gap-2 mb-2">
                  {exploreTrendSection === "cards" && slice.map((r, i) => (
                    <div key={`${r.name}-${r.set}`} className="ht-card p-3 flex items-center justify-between">
                      <div className="flex items-center gap-2.5 min-w-0" onClick={() => openCardDetail(r)} style={{ cursor: "pointer" }}>
                        <span className="ht-mono text-xs font-semibold flex-shrink-0" style={{ color: "var(--muted)", width: 14 }}>{page * perPage + i + 1}</span>
                        <CatDot category={r.category} />
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">{r.name}</div>
                          <div className="text-xs truncate" style={{ color: "var(--muted)" }}>{r.set}</div>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0 ml-2 flex items-center gap-1.5">
                        <div>
                          <div className="ht-mono text-sm font-semibold">{r.comps} comps</div>
                          <TrendTag pct={r.changePct} />
                        </div>
                        <button onClick={() => toggleCardWatch(r)} className="rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0" style={{ background: isCardWatched(r) ? "var(--cyan)" : "var(--panel-2)", border: "1px solid var(--line)" }} title="Add to watchlist">
                          <Bell size={11} color={isCardWatched(r) ? "#0A0912" : "var(--muted)"} />
                        </button>
                      </div>
                    </div>
                  ))}
                  {exploreTrendSection === "sealed" && slice.map((t, i) => (
                    <div key={t.productName} className="ht-card p-3 flex items-center gap-3">
                      <div className="flex items-center gap-2.5 min-w-0 flex-1" onClick={() => openSealedDetail({ productName: t.productName, category: t.category, marketEach: t.price })} style={{ cursor: "pointer" }}>
                        <span className="ht-mono text-xs font-semibold flex-shrink-0" style={{ color: "var(--muted)", width: 14 }}>{page * perPage + i + 1}</span>
                        <CatDot category={t.category} />
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium truncate">{t.productName}</div>
                          <div className="text-xs" style={{ color: "var(--muted)" }}>
                            <span className="uppercase" style={{ color: t.source === "tcgplayer" ? "var(--cyan)" : "var(--amber)" }}>{t.source === "tcgplayer" ? "TCGplayer" : "eBay"}</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="ht-mono text-sm font-semibold">${t.price.toFixed(2)}</div>
                        <TrendTag pct={t.changePct} />
                      </div>
                      <button onClick={() => toggleSealedWatch({ productName: t.productName, category: t.category, marketEach: t.price })}
                        className="rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0" style={{ background: isSealedWatched({ productName: t.productName }) ? "var(--cyan)" : "var(--panel-2)", border: "1px solid var(--line)" }} title="Add to watchlist">
                        <Bell size={11} color={isSealedWatched({ productName: t.productName }) ? "#0A0912" : "var(--muted)"} />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="px-4 flex items-center justify-between mb-4">
                  <button onClick={() => setExploreTrendingPage(p => Math.max(0, p - 1))} disabled={page === 0} className="ht-chip" style={{ opacity: page === 0 ? 0.35 : 1 }}>← Prev</button>
                  <span className="ht-mono text-xs" style={{ color: "var(--muted)" }}>{page + 1} / {totalPages}</span>
                  <button onClick={() => setExploreTrendingPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="ht-chip" style={{ opacity: page >= totalPages - 1 ? 0.35 : 1 }}>Next →</button>
                </div>
              </>
            );
          })()}

          <SectionHeader title="Release Calendar" />
          <p className="px-4 text-xs mb-2" style={{ color: "var(--muted)" }}>Pokémon TCG confirmed dates for now — other categories coming soon.</p>
          <div className="px-4 flex flex-col gap-2 mb-2">
            {RELEASE_CALENDAR.map(item => {
              const daysUntil = Math.ceil((new Date(item.date) - new Date()) / 86400000);
              const status = daysUntil < 0 ? "Released" : daysUntil === 0 ? "Today" : `${daysUntil}d away`;
              return (
                <div key={item.name} className="ht-card p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <CatDot category={item.category} />
                      <div className="text-sm font-medium truncate">{item.name}</div>
                    </div>
                    <span className="ht-mono text-xs font-semibold flex-shrink-0 ml-2" style={{ color: daysUntil < 0 ? "var(--muted)" : "var(--cyan)" }}>{status}</span>
                  </div>
                  <div className="text-xs mt-1" style={{ color: "var(--muted)" }}>{item.date} · {item.note}</div>
                </div>
              );
            })}
          </div>

          <SectionHeader title="Master Set Tracker" />
          <p className="px-4 text-xs mb-2" style={{ color: "var(--muted)" }}>Based on what's in your portfolios right now.</p>
          <div className="px-4 flex flex-col gap-2">
            {MASTER_SETS.map(set => {
              const ownedNames = new Set(allRows.filter(r => r.set.toLowerCase() === set.name.toLowerCase()).map(r => r.name.toLowerCase()));
              const ownedCount = ownedNames.size;
              const pct = Math.min(100, Math.round((ownedCount / set.total) * 100));
              const logo = setLogoUrl(set);
              return (
                <div key={set.name} className="ht-card p-3 flex items-center gap-3">
                  {logo ? (
                    <img src={logo} alt="" style={{ width: 44, height: 44, objectFit: "contain", flexShrink: 0, background: "#fff", borderRadius: 8, padding: 4 }} onError={(e) => { e.target.style.display = "none"; }} />
                  ) : (
                    <div className="rounded-lg flex items-center justify-center flex-shrink-0" style={{ width: 44, height: 44, background: "var(--panel-2)" }}>
                      <CatDot category={set.category} />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold truncate">{set.name}</div>
                    <div className="rounded-full h-1.5 overflow-hidden mt-1.5" style={{ background: "var(--panel-2)" }}>
                      <div style={{ width: `${pct}%`, height: "100%", background: "linear-gradient(90deg, var(--purple), var(--cyan))" }} />
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="ht-mono text-sm font-bold">{pct}%</div>
                    <div className="text-xs" style={{ color: "var(--muted)" }}>{ownedCount}/{set.total}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ============ MY STORE ============ */}
      {tab === "shop" && storeView === "menu" && (
        <div className="ht-fade px-4 pt-6 pb-6">
          <div className="flex items-center justify-between mb-4">
            <h1 className="ht-display text-3xl leading-none">MY STORE</h1>
            <button onClick={() => setStoreReorderMode(m => !m)} className={`ht-chip ${storeReorderMode ? "ht-chip-active" : ""}`}>{storeReorderMode ? "Done" : "Reorder"}</button>
          </div>

          {/* profit hero */}
          <div className="ht-card p-4 mb-3" style={{ background: "linear-gradient(145deg, rgba(139,92,246,0.16), rgba(45,212,232,0.06))" }}>
            <p className="text-xs" style={{ color: "var(--muted)" }}>Net Profit</p>
            <div className="ht-mono text-3xl font-bold mt-1" style={{ color: netProfit >= 0 ? "var(--green)" : "var(--red)" }}>
              {netProfit >= 0 ? "" : "-"}${Math.abs(netProfit).toFixed(2)}
            </div>
            <div className="grid grid-cols-3 gap-2 mt-3 pt-3" style={{ borderTop: "1px solid var(--line)" }}>
              <div><div className="text-xs" style={{ color: "var(--muted)" }}>Revenue</div><div className="ht-mono text-xs font-semibold mt-0.5">${salesRevenue.toFixed(2)}</div></div>
              <div><div className="text-xs" style={{ color: "var(--muted)" }}>Expenses</div><div className="ht-mono text-xs font-semibold mt-0.5">${totalExpenses.toFixed(2)}</div></div>
              <div><div className="text-xs" style={{ color: "var(--muted)" }}>Est. Fees</div><div className="ht-mono text-xs font-semibold mt-0.5">${estFeesOnSales.toFixed(2)}</div></div>
            </div>
          </div>

          {/* featured action — ring up a sale */}
          {!storeReorderMode && (
            <button onClick={() => { if (!gate(STORE_META.pos.label)) return; setStoreView("pos"); }} className="ht-btn-primary rounded-xl p-4 w-full flex items-center gap-3 text-left mb-3">
              <CreditCard size={20} />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold">Ring Up a Sale</div>
                <div className="text-xs opacity-80">Zelle, Venmo, CashApp, cash &amp; more</div>
              </div>
              <ChevronRight size={16} />
            </button>
          )}

          {/* everything else — compact grid */}
          <div className="grid grid-cols-2 gap-2">
            {storeOrder.filter(k => storeReorderMode || k !== "pos").map((storeKey, idx, visible) => {
              const meta = STORE_META[storeKey];
              if (!meta) return null;
              const Icon = meta.icon;
              const realIdx = storeOrder.indexOf(storeKey);
              const isDragging = gridDragKey === `store:${realIdx}`;
              return (
                <div key={storeKey} data-dragrow="store" data-idx={realIdx} className="ht-card p-3 relative"
                  style={{ borderColor: isDragging ? "var(--cyan)" : undefined, transform: isDragging ? "scale(1.04)" : "none", transition: "transform .12s", zIndex: isDragging ? 5 : undefined }}>
                  <button onClick={() => { if (storeReorderMode) return; if (PRO_STORE.includes(storeKey) && !gate(meta.label)) return; setStoreView(storeKey); }} className="w-full text-left flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <div className="rounded-lg w-9 h-9 flex items-center justify-center" style={{ background: "var(--panel-2)" }}><Icon size={17} color={meta.color} /></div>
                      {!isPro && PRO_STORE.includes(storeKey) && (
                        <span className="ht-mono text-xs font-bold px-1.5 py-0.5 rounded" style={{ background: "linear-gradient(90deg, var(--purple), var(--cyan))", color: "#0A0912" }}>PRO</span>
                      )}
                    </div>
                    <div>
                      <div className="text-sm font-semibold">{meta.short}</div>
                      <div className="text-xs leading-snug mt-0.5" style={{ color: "var(--muted)" }}>{meta.desc}</div>
                    </div>
                  </button>
                  {storeReorderMode && (
                    <span onPointerDown={(e) => startGridDrag(e, "store", realIdx, moveStoreByDrag)}
                      className="absolute top-2 right-2 rounded-md p-1" style={{ background: "var(--panel-2)", touchAction: "none", cursor: "grab" }}>
                      <GripVertical size={14} color="var(--muted)" />
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ---- My Store: Kiosk / Showcase Mode ---- */}
      {tab === "shop" && storeView === "kiosk" && (() => {
        // Build the browseable inventory from the selected source.
        // Deliberately EXCLUDES cost basis & profit — this screen faces customers.
        let items = [];
        if (kioskSource === "all" || kioskSource.startsWith("p:")) {
          const pfs = kioskSource === "all" ? portfolios : portfolios.filter(p => `p:${p.id}` === kioskSource);
          items.push(...pfs.flatMap(p => p.rows.map(r => ({ kind: "card", key: `c-${r.id}`, name: r.name, sub: `${r.set}`, condition: r.condition, category: r.category, price: (r.price || 0), qty: r.qty, image: findCatalogImage(r.name, r.set) }))));
        }
        if (kioskSource === "all" || kioskSource.startsWith("sp:")) {
          const sps = kioskSource === "all" ? sealedPortfolios : sealedPortfolios.filter(p => `sp:${p.id}` === kioskSource);
          items.push(...sps.flatMap(p => p.items.map(i => ({ kind: "sealed", key: `s-${i.id}`, name: i.productName, sub: "Sealed product", condition: null, category: i.category, price: i.marketEach, qty: i.qty }))));
        }
        if (kioskCategory !== "all") items = items.filter(i => i.category === kioskCategory);
        const q = kioskSearch.trim().toLowerCase();
        if (q) items = items.filter(i => i.name.toLowerCase().includes(q) || i.sub.toLowerCase().includes(q) || (i.condition || "").toLowerCase().includes(q));
        if (kioskSort === "priceHigh") items.sort((a, b) => b.price - a.price);
        else if (kioskSort === "priceLow") items.sort((a, b) => a.price - b.price);
        else items.sort((a, b) => a.name.localeCompare(b.name));
        const totalShown = items.length;
        return (
        <div className="ht-fade px-4 pt-6 pb-6">
          <div className="flex items-center gap-3 mb-1 no-print">
            <button onClick={() => setStoreView("menu")}><ArrowLeft size={18} /></button>
            <h1 className="text-lg font-semibold">Kiosk Mode</h1>
          </div>
          <p className="text-xs mb-3 no-print" style={{ color: "var(--muted)" }}>Hand the phone or tablet to a customer — prices only, no cost or profit data is shown.</p>

          {/* customer-facing header */}
          <div className="rounded-2xl p-4 mb-3 text-center" style={{ background: "linear-gradient(145deg, rgba(139,92,246,0.2), rgba(45,212,232,0.08))", border: "1px solid var(--line)" }}>
            <div className="ht-display text-3xl leading-none">{profileName}'S INVENTORY</div>
            <div className="text-xs mt-1.5" style={{ color: "var(--muted)" }}>{totalShown} item{totalShown === 1 ? "" : "s"} available · ask about anything you see</div>
          </div>

          {/* seller controls */}
          <select value={kioskSource} onChange={(e) => setKioskSource(e.target.value)} className="ht-input rounded-md px-2 py-2 text-xs w-full mb-2 no-print">
            <option value="all" style={{ background: "var(--panel-2)" }}>Showing: Everything</option>
            {portfolios.map(p => <option key={p.id} value={`p:${p.id}`} style={{ background: "var(--panel-2)" }}>Cards: {p.name}</option>)}
            {sealedPortfolios.map(p => <option key={p.id} value={`sp:${p.id}`} style={{ background: "var(--panel-2)" }}>Sealed: {p.name}</option>)}
          </select>

          {/* customer browse controls */}
          <input value={kioskSearch} onChange={(e) => setKioskSearch(e.target.value)}
            placeholder="Search the inventory..." className="ht-input rounded-lg px-3 py-2.5 text-sm w-full mb-2" />
          <div className="flex items-center gap-2 mb-3 overflow-x-auto ht-scroll">
            <button onClick={() => setKioskCategory("all")} className={`ht-chip flex-shrink-0 ${kioskCategory === "all" ? "ht-chip-active" : ""}`}>All</button>
            {CATEGORIES.map(c => (
              <button key={c.key} onClick={() => setKioskCategory(c.key)} className={`ht-chip flex-shrink-0 ${kioskCategory === c.key ? "ht-chip-active" : ""}`}>{c.label}</button>
            ))}
            <select value={kioskSort} onChange={(e) => setKioskSort(e.target.value)} className="ht-input rounded-md px-2 py-1.5 text-xs ml-auto flex-shrink-0">
              <option value="priceHigh" style={{ background: "var(--panel-2)" }}>Price: High to Low</option>
              <option value="priceLow" style={{ background: "var(--panel-2)" }}>Price: Low to High</option>
              <option value="name" style={{ background: "var(--panel-2)" }}>Name: A to Z</option>
            </select>
          </div>

          {/* inventory grid */}
          <div className="grid grid-cols-2 gap-2">
            {items.map(it => (
              <div key={it.key} className="ht-card flex flex-col overflow-hidden" style={{ padding: 0 }}>
                {/* image area — real card art when matched, styled placeholder otherwise */}
                <div className="relative flex items-center justify-center" style={{ height: 150, background: "radial-gradient(circle at 50% 30%, var(--panel-2), var(--panel))" }}>
                  {it.image ? (
                    <img src={it.image} alt={it.name} loading="lazy"
                      onError={(e) => { e.target.style.display = "none"; }}
                      style={{ maxHeight: 138, maxWidth: "90%", objectFit: "contain", filter: "drop-shadow(0 6px 12px rgba(0,0,0,0.5))" }} />
                  ) : (
                    <div className="flex flex-col items-center gap-1.5">
                      {it.kind === "sealed" ? <Layers size={26} color="var(--muted)" /> : <Sparkles size={26} color="var(--muted)" />}
                      <span className="text-xs" style={{ color: "var(--muted)" }}>{it.kind === "sealed" ? "Sealed product" : "No image yet"}</span>
                    </div>
                  )}
                  {/* badges overlay */}
                  <div className="absolute top-2 left-2 flex items-center gap-1.5">
                    {it.condition && (
                      <span className="ht-mono text-xs font-bold px-1.5 py-0.5 rounded" style={{ background: "rgba(10,9,18,0.85)", color: "var(--cyan)", border: "1px solid var(--line)" }}>{it.condition.replace("Raw ", "")}</span>
                    )}
                    {it.kind === "sealed" && (
                      <span className="ht-mono text-xs font-bold px-1.5 py-0.5 rounded" style={{ background: "rgba(10,9,18,0.85)", color: "var(--amber)", border: "1px solid var(--line)" }}>SEALED</span>
                    )}
                  </div>
                  {it.qty > 1 && (
                    <span className="absolute top-2 right-2 ht-mono text-xs font-bold px-1.5 py-0.5 rounded" style={{ background: "rgba(10,9,18,0.85)", color: "var(--text)", border: "1px solid var(--line)" }}>×{it.qty}</span>
                  )}
                </div>
                {/* info */}
                <div className="p-3 flex flex-col flex-1">
                  <div className="text-sm font-semibold leading-snug">{it.name}</div>
                  <div className="text-xs mb-2" style={{ color: "var(--muted)" }}>{it.sub}</div>
                  <div className="mt-auto ht-mono text-lg font-bold" style={{ color: "var(--green)" }}>${it.price.toFixed(2)}</div>
                </div>
              </div>
            ))}
          </div>
          {items.length === 0 && <p className="text-xs text-center py-10" style={{ color: "var(--muted)" }}>Nothing matches — try clearing the search or filters.</p>}
        </div>
        );
      })()}

      {/* ---- My Store: POS / Register Mode ---- */}
      {tab === "shop" && storeView === "pos" && (
        <div className="ht-fade px-4 pt-6 pb-6">
          <div className="flex items-center gap-3 mb-4">
            <button onClick={() => setStoreView("menu")}><ArrowLeft size={18} /></button>
            <h1 className="text-lg font-semibold">POS / Register Mode</h1>
          </div>

          <SectionHeader title="Linked Payout Methods" />
          <div className="px-4 grid grid-cols-2 gap-2 mb-4">
            {PAYOUT_METHODS.map(m => {
              const connected = m.key === "cash" || !!posConnected[m.key];
              return (
                <button key={m.key} onClick={() => m.key !== "cash" && togglePosConnected(m.key)} className="ht-card p-3 text-left">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold">{m.label}</span>
                    {connected ? <Check size={13} color="var(--green)" /> : <span className="text-xs" style={{ color: "var(--muted)" }}>Link</span>}
                  </div>
                  <span className="text-xs" style={{ color: connected ? "var(--green)" : "var(--muted)" }}>{connected ? "Connected" : "Not connected"}</span>
                </button>
              );
            })}
          </div>

          <SectionHeader title="Current Sale" />
          <div className="px-4">
            <div className="ht-card p-4 mb-3">
              <div className="flex gap-2 mb-2">
                <input value={posItemForm.name} onChange={(e) => setPosItemForm(f => ({ ...f, name: e.target.value }))} placeholder="Item" className="ht-input rounded-md px-3 py-2 text-xs flex-1" />
                <input type="number" value={posItemForm.price} onChange={(e) => setPosItemForm(f => ({ ...f, price: e.target.value }))} placeholder="$" className="ht-input ht-mono rounded-md px-2 py-2 text-xs w-20" />
                <button onClick={addPosItem} className="ht-btn-primary rounded-md px-3 py-2 text-xs font-semibold"><Plus size={14} /></button>
              </div>
              {posCart.map(i => (
                <div key={i.id} className="flex items-center justify-between py-1.5" style={{ borderTop: "1px solid var(--line)" }}>
                  <span className="text-xs">{i.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="ht-mono text-xs font-semibold">${i.price.toFixed(2)}</span>
                    <button onClick={() => removePosItem(i.id)}><X size={12} color="var(--muted)" /></button>
                  </div>
                </div>
              ))}
              {posCart.length === 0 && <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>Cart is empty — add items above.</p>}
            </div>

            <div className="ht-card p-4 mb-3">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs" style={{ color: "var(--muted)" }}>Total</span>
                <span className="ht-mono text-2xl font-bold">${posTotal.toFixed(2)}</span>
              </div>
              <div className="text-xs font-semibold mb-2" style={{ color: "var(--muted)" }}>CHARGE VIA</div>
              <div className="flex gap-2 flex-wrap mb-3">
                {PAYOUT_METHODS.map(m => (
                  <button key={m.key} onClick={() => setPosPayMethod(m.key)} className={`ht-chip ${posPayMethod === m.key ? "ht-chip-active" : ""}`}>{m.label}</button>
                ))}
              </div>
              <button onClick={completePosSale} disabled={posCart.length === 0} className="ht-btn-primary rounded-lg py-3 text-sm font-semibold w-full flex items-center justify-center gap-2">
                {posCharged ? <><Check size={16} /> Sale Logged</> : <><CreditCard size={16} /> Charge ${posTotal.toFixed(2)} via {PAYOUT_METHODS.find(m => m.key === posPayMethod)?.label}</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---- My Store: Top Sellers & Global Trending ---- */}
      {tab === "shop" && storeView === "topsellers" && (() => {
        const soldCounts = {};
        salesLog.forEach(r => { soldCounts[r.name] = (soldCounts[r.name] || 0) + r.price * r.qty; });
        const myTopSellers = Object.entries(soldCounts).sort((a, b) => b[1] - a[1]).slice(0, 8);
        return (
          <div className="ht-fade px-4 pt-6 pb-6">
            <div className="flex items-center gap-3 mb-4">
              <button onClick={() => setStoreView("menu")}><ArrowLeft size={18} /></button>
              <h1 className="text-lg font-semibold">Top Sellers &amp; Global Trending</h1>
            </div>

            <SectionHeader title="Your Top Sellers" />
            <div className="px-4 flex flex-col gap-2 mb-2">
              {myTopSellers.map(([name, total], i) => (
                <div key={name} className="ht-card p-3 flex items-center gap-3">
                  <span className="ht-mono text-xs font-bold w-4" style={{ color: "var(--muted)" }}>{i + 1}</span>
                  <span className="text-sm font-semibold flex-1 min-w-0 truncate">{name}</span>
                  <span className="ht-mono text-sm font-semibold" style={{ color: "var(--green)" }}>${total.toFixed(2)}</span>
                  <button onClick={() => toggleCardWatch({ name, set: "" })} className="rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0" style={{ background: isCardWatched({ name, set: "" }) ? "var(--cyan)" : "var(--panel-2)", border: "1px solid var(--line)" }} title="Add to watchlist">
                    <Bell size={11} color={isCardWatched({ name, set: "" }) ? "#0A0912" : "var(--muted)"} />
                  </button>
                </div>
              ))}
              {myTopSellers.length === 0 && <p className="text-xs" style={{ color: "var(--muted)" }}>No sales logged yet — this fills in as you sell.</p>}
            </div>

            <SectionHeader title="Global Trending (TCGplayer + eBay)" />
            <div className="px-4 flex flex-col gap-2">
              {GLOBAL_TRENDING.map((c, i) => (
                <div key={i} className="ht-card p-3 flex items-center gap-3">
                  <div className="flex items-center gap-3 min-w-0 flex-1" onClick={() => openCardDetail(c)} style={{ cursor: "pointer" }}>
                    <CatDot category={c.category} />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold truncate">{c.name}</div>
                      <div className="text-xs" style={{ color: "var(--muted)" }}>{c.set} · <span className="uppercase" style={{ color: c.source === "tcgplayer" ? "var(--cyan)" : "var(--amber)" }}>{c.source === "tcgplayer" ? "TCGplayer" : "eBay"}</span></div>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="ht-mono text-sm font-bold">${c.price.toFixed(2)}</div>
                    <TrendTag pct={c.changePct} />
                  </div>
                  <button onClick={() => toggleCardWatch(c)} className="rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0" style={{ background: isCardWatched(c) ? "var(--cyan)" : "var(--panel-2)", border: "1px solid var(--line)" }} title="Add to watchlist">
                    <Bell size={11} color={isCardWatched(c) ? "#0A0912" : "var(--muted)"} />
                  </button>
                </div>
              ))}
            </div>
            <p className="px-4 mt-3 text-xs" style={{ color: "var(--muted)" }}>Global trending is illustrative — a production build wires this to TCGplayer's partner API and eBay's Sold Items API.</p>
          </div>
        );
      })()}

      {/* ---- My Store: Customer Want List ---- */}
      {tab === "shop" && storeView === "wantlist" && (
        <div className="ht-fade px-4 pt-6 pb-6">
          <div className="flex items-center gap-3 mb-4">
            <button onClick={() => setStoreView("menu")}><ArrowLeft size={18} /></button>
            <h1 className="text-lg font-semibold">Customer Want List</h1>
          </div>

          <div className="ht-card p-4 mb-4">
            <div className="text-xs font-semibold mb-2" style={{ color: "var(--muted)" }}>ADD REQUEST</div>
            <div className="flex gap-2 mb-2">
              <input value={wantForm.customerName} onChange={(e) => setWantForm(f => ({ ...f, customerName: e.target.value }))} placeholder="Customer name" className="ht-input rounded-md px-3 py-2 text-xs flex-1" />
              <input value={wantForm.contact} onChange={(e) => setWantForm(f => ({ ...f, contact: e.target.value }))} placeholder="Contact (IG, phone)" className="ht-input rounded-md px-3 py-2 text-xs flex-1" />
            </div>
            <input value={wantForm.cardName} onChange={(e) => setWantForm(f => ({ ...f, cardName: e.target.value }))} placeholder="Card they want" className="ht-input rounded-md px-3 py-2 text-xs w-full mb-2" />
            <div className="flex gap-2 mb-2">
              <div className="flex items-center gap-1">
                <span className="ht-mono text-xs" style={{ color: "var(--muted)" }}>$</span>
                <input type="number" value={wantForm.maxPrice} onChange={(e) => setWantForm(f => ({ ...f, maxPrice: e.target.value }))} placeholder="Max price" className="ht-input ht-mono rounded-md px-2 py-2 text-xs w-28" />
              </div>
              <input value={wantForm.notes} onChange={(e) => setWantForm(f => ({ ...f, notes: e.target.value }))} placeholder="Notes (condition, grade...)" className="ht-input rounded-md px-3 py-2 text-xs flex-1" />
            </div>
            <button onClick={addWant} className="ht-btn-primary rounded-md py-2 text-xs font-semibold w-full flex items-center justify-center gap-1.5"><Plus size={13} /> Add to Want List</button>
          </div>

          <SectionHeader title={`Open Requests (${wantList.filter(w => w.status === "open").length})`} />
          <div className="px-4 flex flex-col gap-2">
            {wantList.map(w => (
              <div key={w.id} className="ht-card p-3" style={w.status === "fulfilled" ? { opacity: 0.55 } : undefined}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold truncate">{w.cardName}</div>
                    <div className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>{w.customerName}{w.contact ? ` · ${w.contact}` : ""}</div>
                    {w.notes && <div className="text-xs mt-1" style={{ color: "var(--muted)" }}>{w.notes}</div>}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="ht-mono text-sm font-semibold">≤ ${w.maxPrice.toFixed(2)}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 mt-2 pt-2" style={{ borderTop: "1px solid var(--line)" }}>
                  <button onClick={() => toggleWantStatus(w.id)} className="text-xs font-semibold" style={{ color: w.status === "open" ? "var(--green)" : "var(--muted)" }}>
                    {w.status === "open" ? "Mark Fulfilled" : "Reopen"}
                  </button>
                  <button onClick={() => removeWant(w.id)} className="text-xs" style={{ color: "var(--muted)" }}>Remove</button>
                </div>
              </div>
            ))}
            {wantList.length === 0 && <p className="text-xs" style={{ color: "var(--muted)" }}>No customer requests yet.</p>}
          </div>
        </div>
      )}

      {tab === "shop" && storeView === "sales" && (
        <div className="ht-fade px-4 pt-6 pb-6">
          <div className="flex items-center gap-3 mb-3">
            <button onClick={() => setStoreView("menu")}><ArrowLeft size={18} /></button>
            <h1 className="text-lg font-semibold">Sales Log</h1>
          </div>
          <div className="ht-card p-3 mb-4">
            {!saleForm.sourcePortfolioId ? (
              <>
                <input value={saleSearch} onChange={(e) => setSaleSearch(e.target.value)} placeholder="Search your portfolios to sell a card..."
                  className="ht-input rounded-md px-3 py-2 text-sm w-full mb-2" />
                {saleSearchResults.length > 0 && (
                  <div className="mb-2 flex flex-col gap-1">
                    {saleSearchResults.map(({ row, portfolioName, portfolioId }) => (
                      <button key={row.id} onClick={() => selectSaleSource(row, portfolioName, portfolioId)}
                        className="text-left text-xs px-2.5 py-2 rounded-md flex items-center justify-between" style={{ background: "var(--panel-2)" }}>
                        <span className="truncate">{row.name} <span style={{ color: "var(--muted)" }}>· {portfolioName}</span></span>
                        <span className="ht-mono flex-shrink-0 ml-2">${row.price?.toFixed(2)}</span>
                      </button>
                    ))}
                  </div>
                )}
                <div className="text-xs text-center my-1" style={{ color: "var(--muted)" }}>— or enter manually —</div>
                <input value={saleForm.name} onChange={(e) => setSaleForm(f => ({ ...f, name: e.target.value }))} placeholder="Card name"
                  className="bg-transparent outline-none text-sm w-full mb-2" style={{ color: "var(--text)" }} />
              </>
            ) : (
              <div className="flex items-center justify-between mb-2 px-2.5 py-2 rounded-md" style={{ background: "var(--panel-2)" }}>
                <span className="text-xs">Selling <strong>{saleForm.name}</strong> from {saleForm.sourcePortfolioName}</span>
                <button onClick={clearSaleSource}><X size={14} color="var(--muted)" /></button>
              </div>
            )}
            <div className="flex items-center gap-2 flex-wrap">
              <select value={saleForm.platform} onChange={(e) => setSaleForm(f => ({ ...f, platform: e.target.value }))} className="ht-input rounded-md px-2 py-2 text-xs">
                {Object.entries(PLATFORM_FEES).map(([k, v]) => <option key={k} value={k} style={{ background: "var(--panel-2)" }}>{v.label}</option>)}
              </select>
              <select value={saleForm.paymentMethod} onChange={(e) => setSaleForm(f => ({ ...f, paymentMethod: e.target.value }))} className="ht-input rounded-md px-2 py-2 text-xs">
                <option value="digital" style={{ background: "var(--panel-2)" }}>Digital payment</option>
                <option value="cash" style={{ background: "var(--panel-2)" }}>Cash</option>
              </select>
              <input type="number" value={saleForm.qty} onChange={(e) => setSaleForm(f => ({ ...f, qty: e.target.value }))} placeholder="Qty" disabled={!!saleForm.sourcePortfolioId}
                className="ht-input ht-mono rounded-md px-2 py-2 text-xs w-14 disabled:opacity-50" />
              <div className="flex items-center gap-1 ml-auto">
                <span className="ht-mono text-xs" style={{ color: "var(--muted)" }}>$</span>
                <input type="number" value={saleForm.price} onChange={(e) => setSaleForm(f => ({ ...f, price: e.target.value }))} placeholder="0.00"
                  className="ht-input ht-mono rounded-md px-2 py-2 text-xs w-20" />
              </div>
              <button onClick={addSale} className="ht-btn-primary rounded-md px-3 py-2 text-xs font-semibold">Add</button>
            </div>
            {saleForm.sourcePortfolioId && <p className="text-xs mt-2" style={{ color: "var(--muted)" }}>This card will be removed from {saleForm.sourcePortfolioName} once logged.</p>}
          </div>
          <div className="flex flex-col gap-2">
            {salesLog.map(s => {
              const profit = s.costBasis != null ? (s.price - s.costBasis) * s.qty : null;
              return (
                <div key={s.id} className="ht-card p-3 flex items-center justify-between">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{s.name}</div>
                    <div className="text-xs" style={{ color: "var(--muted)" }}>
                      {PLATFORM_FEES[s.platform]?.label} · {s.date}{s.portfolioName ? ` · from ${s.portfolioName}` : ""}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0 ml-2">
                    <div className="flex items-center gap-2">
                      <span className="ht-mono text-sm font-semibold">${(s.price * s.qty).toFixed(2)}</span>
                      <button onClick={() => removeSale(s.id)}><Trash2 size={13} color="var(--muted)" /></button>
                    </div>
                    {profit !== null && (
                      <div className="ht-mono text-xs font-semibold" style={{ color: profit >= 0 ? "var(--green)" : "var(--red)" }}>
                        {profit >= 0 ? "+" : "-"}${Math.abs(profit).toFixed(2)} profit
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            {salesLog.length === 0 && <p className="text-xs" style={{ color: "var(--muted)" }}>No sales logged yet.</p>}
          </div>
          <div className="text-right mt-3 ht-mono text-sm font-semibold" style={{ color: "var(--green)" }}>${salesRevenue.toFixed(2)} total</div>
        </div>
      )}

      {tab === "shop" && storeView === "expenses" && (
        <div className="ht-fade px-4 pt-6 pb-6">
          <div className="flex items-center gap-3 mb-3">
            <button onClick={() => setStoreView("menu")}><ArrowLeft size={18} /></button>
            <h1 className="text-lg font-semibold">Expenses</h1>
          </div>
          <div className="ht-card p-3 mb-4">
            <input value={expenseForm.label} onChange={(e) => setExpenseForm(f => ({ ...f, label: e.target.value }))} placeholder="Expense description"
              className="bg-transparent outline-none text-sm w-full mb-2" style={{ color: "var(--text)" }} />
            <div className="flex items-center gap-2 flex-wrap">
              <select value={expenseForm.category} onChange={(e) => setExpenseForm(f => ({ ...f, category: e.target.value }))} className="ht-input rounded-md px-2 py-2 text-xs">
                {["Booth Fee", "Travel", "Supplies", "Shipping", "Other"].map(c => <option key={c} value={c} style={{ background: "var(--panel-2)" }}>{c}</option>)}
              </select>
              <div className="flex items-center gap-1 ml-auto">
                <span className="ht-mono text-xs" style={{ color: "var(--muted)" }}>$</span>
                <input type="number" value={expenseForm.amount} onChange={(e) => setExpenseForm(f => ({ ...f, amount: e.target.value }))} placeholder="0.00"
                  className="ht-input ht-mono rounded-md px-2 py-2 text-xs w-20" />
              </div>
              <button onClick={addExpense} className="ht-btn-primary rounded-md px-3 py-2 text-xs font-semibold">Add</button>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            {expenses.map(e => (
              <div key={e.id} className="ht-card p-3 flex items-center justify-between">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{e.label}</div>
                  <div className="text-xs" style={{ color: "var(--muted)" }}>{e.category} · {e.date}</div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                  <span className="ht-mono text-sm font-semibold" style={{ color: "var(--red)" }}>${e.amount.toFixed(2)}</span>
                  <button onClick={() => removeExpense(e.id)}><Trash2 size={13} color="var(--muted)" /></button>
                </div>
              </div>
            ))}
            {expenses.length === 0 && <p className="text-xs" style={{ color: "var(--muted)" }}>No expenses logged yet.</p>}
          </div>
          <div className="text-right mt-3 ht-mono text-sm font-semibold" style={{ color: "var(--red)" }}>${totalExpenses.toFixed(2)} total</div>
        </div>
      )}

      {tab === "shop" && storeView === "fees" && (
        <div className="ht-fade px-4 pt-6 pb-6">
          <div className="flex items-center gap-3 mb-3">
            <button onClick={() => setStoreView("menu")}><ArrowLeft size={18} /></button>
            <h1 className="text-lg font-semibold">Fee Calculator</h1>
          </div>
          <p className="text-xs mb-3" style={{ color: "var(--muted)" }}>Rates are typical 2026 estimates — always verify current rates on the platform.</p>
          <div className="ht-card p-4 mb-3">
            <div className="text-xs font-semibold mb-2" style={{ color: "var(--muted)" }}>PLATFORM</div>
            <div className="flex gap-2 flex-wrap mb-3">
              {Object.entries(PLATFORM_FEES).map(([k, v]) => (
                <button key={k} onClick={() => setFeePlatform(k)} className={`ht-chip ${feePlatform === k ? "ht-chip-active" : ""}`}>{v.label}</button>
              ))}
            </div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs w-20" style={{ color: "var(--muted)" }}>Sale price</span>
              <span className="ht-mono text-xs" style={{ color: "var(--muted)" }}>$</span>
              <input type="number" value={feeSalePrice} onChange={(e) => setFeeSalePrice(Number(e.target.value) || 0)} className="ht-input ht-mono rounded-md px-2 py-2 text-xs flex-1" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs w-20" style={{ color: "var(--muted)" }}>Shipping</span>
              <span className="ht-mono text-xs" style={{ color: "var(--muted)" }}>$</span>
              <input type="number" value={feeShipping} onChange={(e) => setFeeShipping(Number(e.target.value) || 0)} className="ht-input ht-mono rounded-md px-2 py-2 text-xs flex-1" />
            </div>
          </div>
          <div className="ht-card p-4" style={{ borderColor: "var(--cyan)" }}>
            <div className="flex justify-between text-xs mb-1" style={{ color: "var(--muted)" }}><span>Gross</span><span className="ht-mono">${feeGross.toFixed(2)}</span></div>
            <div className="flex justify-between text-xs mb-1" style={{ color: "var(--red)" }}><span>{feeInfo.label} fees ({feeInfo.pct}% + ${feeInfo.flat.toFixed(2)})</span><span className="ht-mono">-${feeAmount.toFixed(2)}</span></div>
            <div className="flex justify-between text-base font-bold mt-2 pt-2" style={{ borderTop: "1px solid var(--line)", color: "var(--green)" }}>
              <span>You keep</span><span className="ht-mono">${feeNet.toFixed(2)}</span>
            </div>
          </div>
        </div>
      )}

      {tab === "shop" && storeView === "connect" && (
        <div className="ht-fade px-4 pt-6 pb-6">
          <div className="flex items-center gap-3 mb-3">
            <button onClick={() => setStoreView("menu")}><ArrowLeft size={18} /></button>
            <h1 className="text-lg font-semibold">Connect Storefront</h1>
          </div>
          <div className="ht-card p-4 mb-3">
            <div className="flex items-center gap-2 text-xs mb-3" style={{ color: "var(--amber)" }}>
              <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: "var(--amber)" }} /> Not connected yet
            </div>
            <div className="text-sm font-semibold mb-1">Holo Relix — holorelix.com</div>
            <p className="text-xs mb-3" style={{ color: "var(--muted)" }}>Once connected, this would keep your storefront and Portfolio in sync automatically:</p>
            <ul className="text-xs flex flex-col gap-1.5" style={{ color: "var(--muted)" }}>
              <li>• Inventory counts stay matched between Shopify and your Portfolio</li>
              <li>• Prices set here can push to your live listings</li>
              <li>• Sold items on Shopify auto-log to your Sales Log</li>
            </ul>
            <button disabled className="ht-btn-primary rounded-lg py-2.5 text-sm font-semibold w-full mt-4 opacity-50">Connect Shopify Store</button>
          </div>
        </div>
      )}

      {/* ============ PROFILE ============ */}
      {tab === "profile" && (
        <div className="ht-fade px-4 pt-6 pb-6">
          <h1 className="ht-display text-3xl leading-none mb-4">PROFILE</h1>

          {/* membership */}
          {isPro ? (
            <div className="ht-card p-4 mb-3" style={{ background: "linear-gradient(145deg, rgba(139,92,246,0.22), rgba(45,212,232,0.08))" }}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="ht-display text-xl leading-none" style={{ background: "linear-gradient(90deg, var(--purple), var(--cyan))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>HOLOHQ PRO</span>
                  </div>
                  <div className="text-xs mt-1" style={{ color: "var(--muted)" }}>{paywallPlan === "annual" ? "Annual plan · $79.99/yr" : "Monthly plan · $9.99/mo"} · all features unlocked</div>
                </div>
                <Sparkles size={20} color="var(--cyan)" />
              </div>
              <button onClick={() => setUserTier("free")} className="text-xs mt-3" style={{ color: "var(--muted)" }}>Cancel subscription</button>
            </div>
          ) : (
            <button onClick={() => { setPaywallTrigger(""); setPaywallOpen(true); }} className="ht-card p-4 mb-3 w-full text-left" style={{ background: "linear-gradient(145deg, rgba(139,92,246,0.22), rgba(45,212,232,0.08))" }}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-bold">Upgrade to HoloHQ Pro</div>
                  <div className="text-xs mt-1" style={{ color: "var(--muted)" }}>POS, Kiosk Mode, AI grading, cross-listing & more — 7-day free trial</div>
                </div>
                <span className="ht-mono text-xs font-bold px-2 py-1 rounded flex-shrink-0" style={{ background: "linear-gradient(90deg, var(--purple), var(--cyan))", color: "#0A0912" }}>TRY FREE</span>
              </div>
            </button>
          )}

          {/* avatar + name */}
          <div className="ht-card p-4 mb-3 flex items-center gap-3">
            <button onClick={() => avatarRef.current?.click()} className="rounded-full flex-shrink-0 flex items-center justify-center overflow-hidden" style={{ width: 52, height: 52, background: "var(--panel-2)", border: "1px solid var(--line)" }}>
              {profileAvatar ? <img src={profileAvatar} alt="avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <User size={20} color="var(--muted)" />}
            </button>
            <input ref={avatarRef} type="file" accept="image/*" className="hidden" onChange={(e) => {
              const f = e.target.files[0]; if (!f) return;
              const reader = new FileReader(); reader.onload = (ev) => setProfileAvatar(ev.target.result); reader.readAsDataURL(f);
            }} />
            <div className="flex-1 min-w-0">
              <input value={profileName} onChange={(e) => setProfileName(e.target.value)} className="bg-transparent outline-none text-sm font-semibold w-full" style={{ color: "var(--text)" }} />
              <div className="flex items-center gap-0.5">
                <span className="text-xs" style={{ color: "var(--cyan)" }}>@</span>
                <input value={profileUsername} onChange={(e) => setProfileUsername(e.target.value.replace(/[^a-zA-Z0-9_\.]/g, "").toLowerCase())} placeholder="username" className="bg-transparent outline-none text-xs w-full" style={{ color: "var(--cyan)" }} />
              </div>
              <button onClick={() => avatarRef.current?.click()} className="text-xs" style={{ color: "var(--muted)" }}>Change photo</button>
            </div>
          </div>

          {/* security */}
          <SectionHeader title="Security" />
          <div className="ht-card p-4 mb-3 mx-0">
            <div className="text-xs font-semibold mb-1" style={{ color: "var(--muted)" }}>EMAIL</div>
            <input value={profileEmail} onChange={(e) => setProfileEmail(e.target.value)} placeholder="you@example.com" className="ht-input rounded-md px-3 py-2 text-xs w-full mb-3" />
            <div className="text-xs font-semibold mb-1" style={{ color: "var(--muted)" }}>PASSWORD</div>
            <div className="flex gap-2 mb-3">
              <input type="password" placeholder="Current password" className="ht-input rounded-md px-3 py-2 text-xs flex-1" />
              <input type="password" placeholder="New password" className="ht-input rounded-md px-3 py-2 text-xs flex-1" />
            </div>
            <button className="ht-input rounded-md px-3 py-2 text-xs font-semibold w-full mb-3">Update Password</button>
            <div className="flex items-center justify-between pt-3" style={{ borderTop: "1px solid var(--line)" }}>
              <div>
                <div className="text-xs font-semibold">Two-Factor Authentication</div>
                <div className="text-xs" style={{ color: "var(--muted)" }}>{twoFAEnabled ? "Enabled" : "Not enabled"}</div>
              </div>
              <button onClick={() => setTwoFAEnabled(v => !v)} className="rounded-full" style={{ width: 40, height: 22, background: twoFAEnabled ? "var(--green)" : "var(--panel-2)", border: "1px solid var(--line)", position: "relative" }}>
                <span style={{ position: "absolute", top: 1, left: twoFAEnabled ? 19 : 1, width: 18, height: 18, borderRadius: "50%", background: "#fff", transition: "left .15s" }} />
              </button>
            </div>
          </div>

          {/* business & label profile */}
          <SectionHeader title="Business & Label Profile" />
          <div className="ht-card p-4 mb-3 mx-0">
            <div className="text-xs font-semibold mb-1" style={{ color: "var(--muted)" }}>BUSINESS NAME (on labels)</div>
            <input value={labelSettings.sellerName} onChange={(e) => setLabelSettings(s => ({ ...s, sellerName: e.target.value }))} className="ht-input rounded-md px-3 py-2 text-xs w-full mb-3" />

            <div className="text-xs font-semibold mb-1" style={{ color: "var(--muted)" }}>BUSINESS LOGO</div>
            <div className="flex items-center gap-2 mb-3">
              <button onClick={() => logoRef.current?.click()} className="ht-input rounded-md px-3 py-2 text-xs flex items-center gap-1.5"><ImageIcon size={13} /> {labelSettings.logoDataUrl ? "Replace" : "Upload"}</button>
              {labelSettings.logoDataUrl && <><img src={labelSettings.logoDataUrl} alt="logo" style={{ height: 24, width: 24, background: "white", borderRadius: 4, objectFit: "contain" }} /><button onClick={() => setLabelSettings(s => ({ ...s, logoDataUrl: null }))}><X size={13} color="var(--muted)" /></button></>}
            </div>

            <div className="text-xs font-semibold mb-2" style={{ color: "var(--muted)" }}>LABEL SIZE</div>
            <div className="flex items-center gap-2 mb-3">
              <span className="ht-chip ht-chip-active">40 × 14mm</span>
              <span className="text-xs" style={{ color: "var(--muted)" }}>Thermal roll printer</span>
            </div>

            <div className="text-xs font-semibold mb-2" style={{ color: "var(--muted)" }}>DEFAULT PRICE ROUNDING</div>
            <div className="flex gap-2 flex-wrap mb-1">
              <select value={labelSettings.roundMode} onChange={(e) => setLabelSettings(s => ({ ...s, roundMode: e.target.value }))} className="ht-input rounded-md px-2 py-2 text-xs">
                {ROUND_MODES.map(m => <option key={m.value} value={m.value} style={{ background: "var(--panel-2)" }}>{m.label}</option>)}
              </select>
              {labelSettings.roundMode !== "none" && (
                <select value={labelSettings.roundIncrement} onChange={(e) => setLabelSettings(s => ({ ...s, roundIncrement: Number(e.target.value) }))} className="ht-input ht-mono rounded-md px-2 py-2 text-xs">
                  {ROUND_INCREMENTS.map(i => <option key={i} value={i} style={{ background: "var(--panel-2)" }}>${i.toFixed(2)}</option>)}
                </select>
              )}
            </div>
            <p className="text-xs" style={{ color: "var(--muted)" }}>This is the same profile used in Portfolio → Price &amp; Label, so changes here apply everywhere.</p>
          </div>

          {/* team & roles */}
          <SectionHeader title="Team &amp; Roles" />
          <div className="ht-card p-4 mb-3 mx-0">
            <div className="text-xs font-semibold mb-2" style={{ color: "var(--muted)" }}>INVITE TEAM MEMBER</div>
            <div className="flex gap-2 mb-2">
              <input value={teamForm.name} onChange={(e) => setTeamForm(f => ({ ...f, name: e.target.value }))} placeholder="Name" className="ht-input rounded-md px-3 py-2 text-xs flex-1" />
              <input value={teamForm.email} onChange={(e) => setTeamForm(f => ({ ...f, email: e.target.value }))} placeholder="Email" className="ht-input rounded-md px-3 py-2 text-xs flex-1" />
            </div>
            <div className="flex gap-2">
              <select value={teamForm.role} onChange={(e) => setTeamForm(f => ({ ...f, role: e.target.value }))} className="ht-input rounded-md px-2 py-2 text-xs flex-1">
                <option value="employee" style={{ background: "var(--panel-2)" }}>Employee</option>
                <option value="admin" style={{ background: "var(--panel-2)" }}>Admin</option>
              </select>
              <button onClick={addTeamMember} className="ht-btn-primary rounded-md px-3 py-2 text-xs font-semibold flex items-center gap-1.5"><Plus size={13} /> Invite</button>
            </div>
            <p className="text-xs mt-2" style={{ color: "var(--muted)" }}>Admins get full access including financials, exports, and team management. Employees can price, label, and log sales, but can't see revenue, expenses, or tax exports.</p>
          </div>

          <div className="flex flex-col gap-2 mb-3">
            {team.map(m => (
              <div key={m.id} className="ht-card p-3 flex items-center gap-3">
                <div className="rounded-full w-9 h-9 flex items-center justify-center flex-shrink-0" style={{ background: "var(--panel-2)" }}><Users size={15} color="var(--muted)" /></div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold truncate">{m.name}</div>
                  <div className="text-xs truncate" style={{ color: "var(--muted)" }}>{m.email}</div>
                </div>
                {m.id === "t1" ? (
                  <span className="ht-chip ht-chip-active">Admin (You)</span>
                ) : (
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <select value={m.role} onChange={(e) => setTeamRole(m.id, e.target.value)} className="ht-input rounded-md px-2 py-1.5 text-xs">
                      <option value="employee" style={{ background: "var(--panel-2)" }}>Employee</option>
                      <option value="admin" style={{ background: "var(--panel-2)" }}>Admin</option>
                    </select>
                    <button onClick={() => removeTeamMember(m.id)}><Trash2 size={14} color="var(--muted)" /></button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      </>)}

      {/* ============ PAYWALL ============ */}

      {/* ---- Profile: appearance, show mode, CSV import, referral ---- */}
      {tab === "profile" && (
        <div className="px-4 pb-6 flex flex-col gap-3">
          {/* appearance */}
          <div className="ht-card p-4">
            <div className="text-xs font-semibold mb-3" style={{ color: "var(--muted)", letterSpacing: "0.06em" }}>APPEARANCE</div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {isDark ? <Moon size={15} color="var(--muted)" /> : <Sun size={15} color="var(--amber)" />}
                <span className="text-sm">{isDark ? "Dark Mode" : "Light Mode"}</span>
              </div>
              <button onClick={() => { setColorMode(isDark ? "light" : "dark"); haptic(30); }}
                className="rounded-full flex-shrink-0" style={{ width: 44, height: 24, background: isDark ? "var(--purple)" : "var(--panel-2)", border: "1px solid var(--line)", position: "relative" }}>
                <span style={{ position: "absolute", top: 2, left: isDark ? 21 : 2, width: 18, height: 18, borderRadius: "50%", background: isDark ? "var(--cyan)" : "var(--muted)", transition: "left .15s" }} />
              </button>
            </div>
          </div>
          {/* show mode */}
          <div className="ht-card p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold flex items-center gap-2"><Zap size={15} color="var(--amber)" /> Show Mode</div>
                <div className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>Queues sales offline — syncs when wifi returns</div>
              </div>
              <button onClick={() => { setShowModeActive(m => !m); haptic(30); }}
                className="rounded-full flex-shrink-0" style={{ width: 44, height: 24, background: showModeActive ? "var(--green)" : "var(--panel-2)", border: "1px solid var(--line)", position: "relative" }}>
                <span style={{ position: "absolute", top: 2, left: showModeActive ? 21 : 2, width: 18, height: 18, borderRadius: "50%", background: showModeActive ? "#fff" : "var(--muted)", transition: "left .15s" }} />
              </button>
            </div>
          </div>
          {/* CSV import */}
          <div className="ht-card p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold flex items-center gap-2"><FileSpreadsheet size={15} color="var(--cyan)" /> Bulk CSV Import</div>
                <div className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>Import a spreadsheet of cards into any portfolio</div>
              </div>
              <button onClick={() => setCsvImportOpen(true)} className="ht-chip">Import</button>
            </div>
          </div>
          {/* account / cloud sync */}
          <div className="ht-card p-4">
            {supaUser ? (
              <div>
                <div className="text-sm font-semibold mb-0.5 flex items-center gap-2">
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--green)" }} /> Signed in
                </div>
                <div className="text-xs mb-3" style={{ color: "var(--muted)" }}>{supaUser.email} · data syncs across all your devices</div>
                <button onClick={() => signOut()} className="text-xs" style={{ color: "var(--red)" }}>Sign out</button>
              </div>
            ) : (
              <div>
                <div className="text-sm font-semibold mb-1">Cloud Sync</div>
                <div className="text-xs mb-3" style={{ color: "var(--muted)" }}>Sign in to sync your portfolios across devices and back up securely.</div>
                <div className="flex gap-2">
                  <button onClick={() => setAuthView("login")} className="ht-chip flex-1 text-center">Sign In</button>
                  <button onClick={() => setAuthView("signup")} className="ht-btn-primary rounded-lg px-4 py-2 text-xs font-semibold flex-1 text-center">Sign Up Free</button>
                </div>
              </div>
            )}
          </div>

          {/* referral */}
          <div className="ht-card p-4" style={{ background: "linear-gradient(145deg, rgba(139,92,246,0.12), rgba(45,212,232,0.05))" }}>
            <div className="text-sm font-semibold mb-1 flex items-center gap-2"><Gift size={15} color="var(--purple)" /> Refer a Friend</div>
            <p className="text-xs mb-3" style={{ color: "var(--muted)" }}>Share your code — your friend gets 1 month free, you get 1 month free when they subscribe.</p>
            <div className="flex items-center gap-2">
              <div className="ht-card flex-1 px-3 py-2 flex items-center justify-center">
                <span className="ht-mono text-sm font-bold" style={{ color: "var(--cyan)", letterSpacing: "0.1em" }}>{referralCode}</span>
              </div>
              <button onClick={copyReferral} className="ht-chip flex-shrink-0" style={{ background: referralCopied ? "var(--green)" : "var(--panel-2)", color: referralCopied ? "#0A0912" : "var(--text)" }}>
                {referralCopied ? "Copied!" : "Copy"}
              </button>
              <button onClick={() => { if (navigator.share) navigator.share({ title: "HoloHQ", text: `Use my code ${referralCode} and get 1 month of HoloHQ Pro free!` }); haptic(30); }} className="ht-chip flex-shrink-0">
                <Share2 size={13} />
              </button>
            </div>
          </div>
        </div>
      )}


            {/* ============ ONBOARDING ============ */}
      {!onboardingDone && (
        <div style={{ position: "fixed", inset: 0, zIndex: 80, background: "rgba(5,4,10,0.97)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div className="ht-fade" style={{ maxWidth: 360, width: "100%", textAlign: "center" }}>
            <div className="ht-display text-5xl leading-none mb-2" style={{ background: "linear-gradient(90deg, var(--purple), var(--cyan))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>HOLOHQ</div>
            <p className="text-xs mb-8" style={{ color: "var(--muted)" }}>Your card business, all in one place</p>
            {(() => {
              const step = ONBOARDING_STEPS[onboardingStep];
              const Icon = step.icon;
              return (
                <div className="ht-fade" key={onboardingStep}>
                  <div className="rounded-2xl w-20 h-20 flex items-center justify-center mx-auto mb-6" style={{ background: "linear-gradient(145deg, rgba(139,92,246,0.3), rgba(45,212,232,0.1))", border: "1px solid var(--purple)" }}>
                    <Icon size={34} color="var(--cyan)" />
                  </div>
                  <h2 className="text-xl font-bold mb-3">{step.title}</h2>
                  <p className="text-sm leading-relaxed mb-8" style={{ color: "var(--muted)" }}>{step.body}</p>
                </div>
              );
            })()}
            <div className="flex items-center justify-center gap-2 mb-6">
              {ONBOARDING_STEPS.map((_, i) => (
                <div key={i} style={{ width: i === onboardingStep ? 20 : 6, height: 6, borderRadius: 3, background: i === onboardingStep ? "var(--cyan)" : "var(--panel-2)", transition: "width .2s" }} />
              ))}
            </div>
            <button onClick={() => {
              haptic(30);
              if (onboardingStep < ONBOARDING_STEPS.length - 1) setOnboardingStep(s => s + 1);
              else { setOnboardingDone(true); }
            }} className="ht-btn-primary rounded-xl py-4 w-full" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontSize: 16, fontWeight: 700 }}>
              {onboardingStep < ONBOARDING_STEPS.length - 1 ? (<><span>Next</span><SkipForward size={16} /></>) : (<><span>Get Started</span><Play size={16} /></>)}
            </button>
            {onboardingStep > 0 && (
              <button onClick={() => setOnboardingStep(s => s - 1)} className="mt-3 text-xs" style={{ color: "var(--muted)" }}>← Back</button>
            )}
            <button onClick={() => setOnboardingDone(true)} className="mt-3 text-xs block mx-auto" style={{ color: "var(--muted)" }}>Skip</button>
          </div>
        </div>
      )}

      {/* ============ SHOW MODE BANNER ============ */}
      {showModeActive && (
        <div className="no-print" style={{ position: "sticky", top: 36, zIndex: 18, background: showModeQueue.length ? "rgba(245,165,36,0.15)" : "rgba(52,211,153,0.12)", borderBottom: "1px solid var(--amber)", display: "flex", alignItems: "center", gap: 8, padding: "4px 12px" }}>
          {showModeQueue.length ? <WifiOff size={13} color="var(--amber)" /> : <Wifi size={13} color="var(--green)" />}
          <span className="text-xs font-semibold flex-1" style={{ color: showModeQueue.length ? "var(--amber)" : "var(--green)" }}>
            Show Mode {showModeQueue.length ? `· ${showModeQueue.length} sale${showModeQueue.length > 1 ? "s" : ""} queued offline` : "· Live"}
          </span>
          {showModeQueue.length > 0 && (
            <button onClick={flushShowQueue} disabled={syncingQueue} className="text-xs font-semibold px-2 py-0.5 rounded" style={{ background: "var(--amber)", color: "#0A0912" }}>
              {syncingQueue ? "Syncing…" : "Sync Now"}
            </button>
          )}
          <button onClick={() => setShowModeActive(false)} className="text-xs" style={{ color: "var(--muted)" }}>Exit</button>
        </div>
      )}

      {/* share copied toast */}
      {shareCardItem && (
        <div className="ht-fade no-print" style={{ position: "fixed", bottom: 90, left: "50%", transform: "translateX(-50%)", zIndex: 50, background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 12, padding: "8px 16px", display: "flex", gap: 8, alignItems: "center", pointerEvents: "none" }}>
          <Check size={14} color="var(--green)" />
          <span className="text-xs font-semibold">Copied to clipboard</span>
        </div>
      )}

      {/* ============ CSV IMPORT MODAL ============ */}
      {csvImportOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(5,4,10,0.85)", display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={() => setCsvImportOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} className="ht-fade" style={{ width: "100%", maxWidth: 430, background: "var(--panel)", borderRadius: "20px 20px 0 0", border: "1px solid var(--line)", borderBottom: "none", padding: 20, paddingBottom: 36 }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold">Bulk CSV Import</h2>
              <button onClick={() => setCsvImportOpen(false)}><X size={18} color="var(--muted)" /></button>
            </div>
            <p className="text-xs mb-3" style={{ color: "var(--muted)" }}>Upload a spreadsheet with columns: <span className="ht-mono" style={{ color: "var(--cyan)" }}>name, set, condition, qty, cost, category</span> — headers are flexible.</p>
            <select value={csvImportPortfolioId} onChange={(e) => setCsvImportPortfolioId(e.target.value)} className="ht-input rounded-md px-2 py-2 text-xs w-full mb-3">
              <option value="" style={{ background: "var(--panel-2)" }}>Select destination portfolio…</option>
              {portfolios.map(p => <option key={p.id} value={p.id} style={{ background: "var(--panel-2)" }}>{p.name}</option>)}
            </select>
            <input ref={csvImportRef} type="file" accept=".csv,.tsv,text/csv" className="hidden" onChange={(e) => { if (e.target.files[0]) handleCsvImport(e.target.files[0]); e.target.value = ""; }} />
            {!csvImportResult ? (
              <button onClick={() => csvImportRef.current?.click()} className="ht-btn-primary rounded-lg py-3 text-sm font-semibold w-full flex items-center justify-center gap-2">
                <FileSpreadsheet size={16} /> Choose CSV File
              </button>
            ) : (
              <div className="ht-fade">
                {csvImportResult.error ? (
                  <p className="text-xs" style={{ color: "var(--red)" }}>Couldn't read that file — make sure it's a valid CSV.</p>
                ) : (
                  <>
                    <div className="ht-card p-3 mb-3">
                      <div className="text-sm font-semibold">{csvImportResult.rows.length} cards ready to import</div>
                      <div className="text-xs mt-1" style={{ color: "var(--muted)" }}>{csvImportResult.fileName}</div>
                      <div className="flex flex-col gap-1 mt-2">
                        {csvImportResult.rows.slice(0, 3).map((r, i) => (
                          <div key={i} className="text-xs" style={{ color: "var(--muted)" }}>• {r.name} · {r.condition} · qty {r.qty}</div>
                        ))}
                        {csvImportResult.rows.length > 3 && <div className="text-xs" style={{ color: "var(--muted)" }}>+{csvImportResult.rows.length - 3} more</div>}
                      </div>
                    </div>
                    <button onClick={confirmCsvImport} disabled={!csvImportPortfolioId} className="ht-btn-primary rounded-lg py-3 text-sm font-semibold w-full">
                      Import {csvImportResult.rows.length} Cards into Portfolio
                    </button>
                    <button onClick={() => setCsvImportResult(null)} className="mt-2 w-full text-center text-xs" style={{ color: "var(--muted)" }}>Choose a different file</button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {paywallOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(5,4,10,0.82)", backdropFilter: "blur(4px)", display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={() => setPaywallOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} className="ht-fade" style={{ width: "100%", maxWidth: 430, maxHeight: "92vh", overflowY: "auto", background: "var(--panel)", borderRadius: "20px 20px 0 0", border: "1px solid var(--line)", borderBottom: "none" }}>
            {/* header */}
            <div className="p-5 pb-4 text-center" style={{ background: "linear-gradient(160deg, rgba(139,92,246,0.35), rgba(45,212,232,0.12))", borderRadius: "20px 20px 0 0" }}>
              <div className="flex justify-end">
                <button onClick={() => setPaywallOpen(false)}><X size={18} color="var(--muted)" /></button>
              </div>
              <div className="ht-display text-4xl leading-none" style={{ background: "linear-gradient(90deg, var(--purple), var(--cyan))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>HOLOHQ PRO</div>
              {paywallTrigger ? (
                <p className="text-sm mt-2 font-semibold">{paywallTrigger} is a Pro feature</p>
              ) : (
                <p className="text-sm mt-2 font-semibold">Run your whole card business from one app</p>
              )}
              <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>One flipped card a month pays for it.</p>
            </div>

            {/* benefits */}
            <div className="px-5 py-4 flex flex-col gap-2.5">
              {[
                [CreditCard, "POS Register — ring up sales with Zelle, Venmo & CashApp at shows"],
                [ImageIcon, "Kiosk Mode — hand customers a browsable showcase of your inventory"],
                [Sparkles, "AI tools — grade prediction, condition checks & bulk photo intake"],
                [Repeat, "Cross-list to eBay, TCGplayer, Whatnot & Shopify in one tap"],
                [Receipt, "Tax export & printable insurance appraisals"],
                [Layers, "Unlimited portfolios & unlimited watchlist alerts"],
              ].map(([Icon, text], i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <div className="rounded-md flex items-center justify-center flex-shrink-0" style={{ width: 26, height: 26, background: "var(--panel-2)" }}>
                    <Icon size={14} color="var(--cyan)" />
                  </div>
                  <span className="text-xs leading-snug pt-1">{text}</span>
                </div>
              ))}
            </div>

            {/* plans */}
            <div className="px-5 flex gap-2">
              <button onClick={() => setPaywallPlan("monthly")} className="flex-1 rounded-xl p-3 text-left relative" style={{ border: paywallPlan === "monthly" ? "2px solid var(--cyan)" : "1px solid var(--line)", background: "var(--panel-2)" }}>
                <span className="absolute ht-mono text-xs font-bold px-1.5 py-0.5 rounded" style={{ top: -9, right: 8, background: "linear-gradient(90deg, var(--purple), var(--cyan))", color: "#0A0912" }}>POPULAR</span>
                <div className="text-xs font-semibold">Monthly</div>
                <div className="ht-mono text-xl font-bold mt-0.5">$9.99<span className="text-xs font-normal" style={{ color: "var(--muted)" }}>/mo</span></div>
                <div className="text-xs mt-0.5" style={{ color: "var(--green)" }}>7-day free trial</div>
              </button>
              <button onClick={() => setPaywallPlan("annual")} className="flex-1 rounded-xl p-3 text-left" style={{ border: paywallPlan === "annual" ? "2px solid var(--cyan)" : "1px solid var(--line)", background: "var(--panel-2)" }}>
                <div className="text-xs font-semibold">Annual</div>
                <div className="ht-mono text-xl font-bold mt-0.5">$79.99<span className="text-xs font-normal" style={{ color: "var(--muted)" }}>/yr</span></div>
                <div className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>≈ $6.67/mo · save 33%</div>
              </button>
            </div>

            {/* CTA */}
            <div className="px-5 py-4">
              <button onClick={() => { setUserTier("pro"); setPaywallOpen(false); }} className="ht-btn-primary rounded-xl py-3.5 text-sm font-bold w-full">
                {paywallPlan === "monthly" ? "Start 7-Day Free Trial" : "Get Annual — Save 33%"}
              </button>
              <p className="text-xs text-center mt-2.5" style={{ color: "var(--muted)" }}>
                {paywallPlan === "monthly" ? "Free for 7 days, then $9.99/mo. Cancel anytime in Profile." : "Billed $79.99 today. Cancel anytime in Profile."}
              </p>
              <p className="text-xs text-center mt-1.5" style={{ color: "var(--muted)" }}>Payments are simulated in this demo — production wires this to Stripe / RevenueCat.</p>
            </div>
          </div>
        </div>
      )}

      {/* ============ BOTTOM NAV (mobile) ============ */}
      <div className="no-print" style={{ position: "fixed", bottom: 0, left: 0, right: 0, width: "100%", background: "var(--panel)", borderTop: "1px solid var(--line)", display: "flex", justifyContent: "space-around", padding: "8px 2px", zIndex: 10 }}>
        {NAV.map(item => {
          const Icon = item.icon;
          const active = tab === item.key;
          return (
            <button key={item.key} onClick={() => { setTab(item.key); setCardDetail(null); setSealedDetail(null); setCardAddPickerOpen(false); setSealedAddPickerOpen(false); if (item.key !== "portfolio") { setActivePortfolioId(null); setActiveSealedPortfolioId(null); setPortfolioSection("cards"); setAllItemsOpen(false); } if (item.key !== "tools") setToolsView("menu"); if (item.key !== "explore") setExploreView("menu"); if (item.key !== "shop") setStoreView("menu"); if (item.key !== "search") { setSearchFullView(false); } setLabelView(false); }}
              style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, color: active ? "var(--cyan)" : "var(--muted)", flex: 1 }}>
              <Icon size={18} />
              <span style={{ fontSize: 9 }}>{item.label}</span>
            </button>
          );
        })}
      </div>


    </div>
  );
}
