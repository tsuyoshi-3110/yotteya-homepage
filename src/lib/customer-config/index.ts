export {
  getCustomerConfigOverride,
  getDefaultCustomerConfig,
  isValidCustomerConfigOverride,
  mergeCustomerConfig,
  resolveCustomerConfig,
  resolveCustomerConfigDocument,
} from "./resolve";

export {
  buildDefaultSiteJsonLdGraph,
  buildSiteJsonLdGraph,
  loadSiteJsonLdGraph,
} from "./site-jsonld";

export {
  getDomainLookupCandidates,
  normalizeHostname,
  resolveTenantSiteKey,
} from "./tenant-resolver";

export {
  buildTenantRobots,
  buildTenantSitemap,
  loadTenantRobots,
  loadTenantSitemap,
  SITEMAP_PATHS,
} from "./public-routes";

export type {
  CustomerConfig,
  CustomerConfigOverride,
  CustomerSiteDocument,
} from "@/config/customer.types";

export type {
  ReadSiteJsonLdDocument,
  SiteJsonLdGraph,
} from "./site-jsonld";

export type {
  ReadDomainDocument,
  TenantResolution,
  TenantResolutionReason,
} from "./tenant-resolver";
