type HubspotCompanyProperties = {
  name?: string;
  domain?: string;
  phone?: string;
  createdate?: string;
  lastmodifieddate?: string;
};

export type HubspotCompany = {
  id: string;
  properties: HubspotCompanyProperties;
  createdAt: string;
  updatedAt: string;
};
