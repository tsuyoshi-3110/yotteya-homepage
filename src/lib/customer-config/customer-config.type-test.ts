import type {
  CustomerConfig,
  CustomerConfigOverride,
  CustomerSiteDocument,
} from "@/config/customer.types";

const validOverride: CustomerConfigOverride = {
  brand: {
    name: "別ブランド名",
  },
  address: {
    latitude: 34.7,
  },
  faq: [
    {
      question: "質問",
      answer: "回答",
    },
  ],
};

const validDocument: CustomerSiteDocument = {
  config: validOverride,
};

declare const resolved: CustomerConfig;

resolved.brand.name satisfies string;
resolved.address.latitude satisfies number;
validDocument satisfies CustomerSiteDocument;

const invalidOverride: CustomerConfigOverride = {
  brand: {
    // @ts-expect-error brand.name must remain a string
    name: 123,
  },
};

invalidOverride satisfies CustomerConfigOverride;
