type FilterOperator =
  | 'EQ'
  | 'NEQ'
  | 'CONTAINS_TOKEN'
  | 'NOT_CONTAINS_TOKEN'
  | 'HAS_PROPERTY'
  | 'NOT_HAS_PROPERTY';

type Filter = {
  propertyName: string;
  operator: FilterOperator;
  value?: string;
};

type FilterGroup = { filters: Filter[] };

type Sort = { propertyName: string; direction: 'ASCENDING' | 'DESCENDING' };

export class SearchObjectsDto {
  filterGroups?: FilterGroup[];
  sorts?: Sort[];
  properties?: string[];
  limit?: number;
  after?: string;
}
