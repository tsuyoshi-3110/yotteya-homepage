// next-sitemap.config.js
const { CUSTOMER } = require("./src/config/customer.ts");

/** @type {import('next-sitemap').IConfig} */
module.exports = {
  siteUrl: CUSTOMER.productionUrl,
  generateRobotsTxt: true,
  sitemapSize: 5000,
  outDir: "public",
  changefreq: "daily",
  priority: 0.7,
};
