type HubspotDealProperties = {
  dealname?: string;
  amount?: string;
  deal_currency_code?: string;
  dealstage?: string;
  pipeline?: string;
  closedate?: string;
  createdate?: string;
  lastmodifieddate?: string;
};

export type HubspotDeal = {
  id: string;
  properties: HubspotDealProperties;
  createdAt: string;
  updatedAt: string;
};
