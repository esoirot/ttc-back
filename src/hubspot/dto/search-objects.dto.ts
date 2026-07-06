import { ApiProperty } from '@nestjs/swagger';

const FILTER_OPERATORS = [
  'EQ',
  'NEQ',
  'CONTAINS_TOKEN',
  'NOT_CONTAINS_TOKEN',
  'HAS_PROPERTY',
  'NOT_HAS_PROPERTY',
] as const;

type FilterOperator = (typeof FILTER_OPERATORS)[number];

const SORT_DIRECTIONS = ['ASCENDING', 'DESCENDING'] as const;

type SortDirection = (typeof SORT_DIRECTIONS)[number];

class Filter {
  @ApiProperty({
    description: 'HubSpot property internal name',
    example: 'email',
  })
  propertyName!: string;

  @ApiProperty({ enum: FILTER_OPERATORS })
  operator!: FilterOperator;

  @ApiProperty({
    description: 'Comparison value; omit for HAS_PROPERTY/NOT_HAS_PROPERTY',
    required: false,
  })
  value?: string;
}

class FilterGroup {
  @ApiProperty({
    description:
      'Filters within a group are AND-ed; groups themselves are OR-ed',
    type: () => [Filter],
  })
  filters!: Filter[];
}

class Sort {
  @ApiProperty({ example: 'createdate' })
  propertyName!: string;

  @ApiProperty({ enum: SORT_DIRECTIONS })
  direction!: SortDirection;
}

export class SearchObjectsDto {
  @ApiProperty({ required: false, type: () => [FilterGroup] })
  filterGroups?: FilterGroup[];

  @ApiProperty({ required: false, type: () => [Sort] })
  sorts?: Sort[];

  @ApiProperty({
    description: 'HubSpot properties to return per result',
    required: false,
    type: [String],
    example: ['email', 'firstname', 'lastname'],
  })
  properties?: string[];

  @ApiProperty({ required: false, example: 10 })
  limit?: number;

  @ApiProperty({
    description: 'Pagination cursor from a previous response',
    required: false,
  })
  after?: string;
}
