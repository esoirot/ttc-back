type HubspotContactProperties = {
  email?: string;
  firstname?: string;
  lastname?: string;
  phone?: string;
  company?: string;
  createdate?: string;
  lastmodifieddate?: string;
};

export type HubspotContact = {
  id: string;
  properties: HubspotContactProperties;
  createdAt: string;
  updatedAt: string;
};
