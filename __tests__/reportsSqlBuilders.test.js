/**
 * Golden-master (characterization) test for src/localDbQueries/reports.js.
 *
 * Purpose: lock the EXACT SQL that every report query function emits, so the
 * maintainability refactor (extracting/deduplicating the SQL builders into
 * reportsSqlBuilders.js) can be proven behavior-preserving.
 *
 * How it works:
 *   - getDBConnection is mocked with a fake db whose executeSql records the SQL
 *     string instead of running it (and returns empty, well-formed result sets
 *     so the functions complete without a real database).
 *   - buildRevenueGroupMonthTotalSql is stubbed to echo its args, so the snapshot
 *     captures how each call site wires groupIdSql/dateSql (and the refactor must
 *     preserve that wiring) without depending on revenues.js internals.
 *   - constants/appConfig is stubbed so importing the real createQueryFilter
 *     (which we keep, to capture the real WHERE-clause wiring) does not pull in
 *     native modules.
 *
 * The captured SQL is whitespace-normalized before snapshotting, so the refactor
 * is free to reformat the generated SQL as long as it stays semantically
 * identical. These snapshots are the record of the original behavior, with ONE
 * deliberate, reviewed exception applied after baselining: the item reports'
 * `previous_month_total_added/removed_stock_qty` output columns were corrected to
 * read the subquery's real `*_qty` source instead of `*_cost` (a copy-paste bug).
 * Do NOT otherwise regenerate these snapshots — a `-u` should only ever change
 * them for an intentional, reviewed SQL change.
 */

let mockCapturedSqls = [];

jest.mock('../src/localDb', () => ({
  getDBConnection: jest.fn(async () => ({
    executeSql: jest.fn(async sql => {
      mockCapturedSqls.push(sql);
      return [
        {
          rows: {
            length: 0,
            item: () => undefined,
            raw: () => [],
          },
        },
      ];
    }),
  })),
}));

jest.mock('../src/localDbQueries/revenues', () => ({
  buildRevenueGroupMonthTotalSql: jest.fn(
    ({groupIdSql, dateSql}) => `RG_TOTAL(group=${groupIdSql} date=${dateSql})`,
  ),
}));

// createQueryFilter (kept real) lives in localDbQueryHelpers, which imports
// constants/appConfig -> react-native-fast-secure-storage. Stub appConfig so the
// import chain does not load native modules.
jest.mock('../src/constants/appConfig', () => ({
  __esModule: true,
  default: () => ({}),
}));

const reports = require('../src/localDbQueries/reports');

const normalizeSql = sql => sql.replace(/\s+/g, ' ').trim();

async function captureSql(fnName, params, pageParam = 1) {
  mockCapturedSqls = [];
  await reports[fnName]({queryKey: ['report-key', params], pageParam});
  return mockCapturedSqls.map(normalizeSql);
}

const FILTER = {'x.flag': 'on'};
const DATE_FILTER = '2026-05-01';

const monthlyParams = {filter: FILTER, dateFilter: DATE_FILTER, limit: 15};

const customSelectedMonth = {
  filter: FILTER,
  dateFilter: DATE_FILTER,
  limit: 1000,
  monthYearDateFilter: DATE_FILTER,
  selectedMonthYearDateFilter: DATE_FILTER,
};
const customMonthToDate = {
  filter: FILTER,
  dateFilter: DATE_FILTER,
  limit: 1000,
  monthToDateFilter: {start: '2026-05-01', end: '2026-05-15'},
};
const customDateRange = {
  filter: FILTER,
  dateFilter: DATE_FILTER,
  limit: 1000,
  dateRangeFilter: {start: '2026-04-01', end: '2026-05-15'},
};

describe('reports.js generated SQL (golden master)', () => {
  it('getItemsMonthlyReport', async () => {
    expect(await captureSql('getItemsMonthlyReport', monthlyParams, 2)).toMatchSnapshot();
  });

  it('getItemsMonthlyReportTotals', async () => {
    expect(
      await captureSql('getItemsMonthlyReportTotals', {...monthlyParams, limit: 0}),
    ).toMatchSnapshot();
  });

  it('getItemReport', async () => {
    expect(await captureSql('getItemReport', {id: 'ITEM_X'})).toMatchSnapshot();
  });

  it('getCategoriesMonthlyReport', async () => {
    expect(await captureSql('getCategoriesMonthlyReport', monthlyParams)).toMatchSnapshot();
  });

  it('getCategoriesMonthlyReportTotals', async () => {
    expect(
      await captureSql('getCategoriesMonthlyReportTotals', {...monthlyParams, limit: 0}),
    ).toMatchSnapshot();
  });

  it('getItemsCustomReport (selected month)', async () => {
    expect(await captureSql('getItemsCustomReport', customSelectedMonth)).toMatchSnapshot();
  });

  it('getItemsCustomReport (month to date)', async () => {
    expect(await captureSql('getItemsCustomReport', customMonthToDate)).toMatchSnapshot();
  });

  it('getItemsCustomReport (date range)', async () => {
    expect(await captureSql('getItemsCustomReport', customDateRange)).toMatchSnapshot();
  });

  it('getItemsCustomReportTotals (selected month)', async () => {
    expect(await captureSql('getItemsCustomReportTotals', customSelectedMonth)).toMatchSnapshot();
  });

  it('getItemsCustomReportTotals (month to date)', async () => {
    expect(await captureSql('getItemsCustomReportTotals', customMonthToDate)).toMatchSnapshot();
  });

  it('getItemsCustomReportTotals (date range)', async () => {
    expect(await captureSql('getItemsCustomReportTotals', customDateRange)).toMatchSnapshot();
  });

  it('getCategoriesCustomReport (selected month)', async () => {
    expect(await captureSql('getCategoriesCustomReport', customSelectedMonth)).toMatchSnapshot();
  });

  it('getCategoriesCustomReport (month to date)', async () => {
    expect(await captureSql('getCategoriesCustomReport', customMonthToDate)).toMatchSnapshot();
  });

  it('getCategoriesCustomReport (date range)', async () => {
    expect(await captureSql('getCategoriesCustomReport', customDateRange)).toMatchSnapshot();
  });

  it('getCategoriesCustomReportTotals (selected month)', async () => {
    expect(
      await captureSql('getCategoriesCustomReportTotals', customSelectedMonth),
    ).toMatchSnapshot();
  });

  it('getCategoriesCustomReportTotals (month to date)', async () => {
    expect(
      await captureSql('getCategoriesCustomReportTotals', customMonthToDate),
    ).toMatchSnapshot();
  });

  it('getCategoriesCustomReportTotals (date range)', async () => {
    expect(
      await captureSql('getCategoriesCustomReportTotals', customDateRange),
    ).toMatchSnapshot();
  });

  it('getRevenueGroupsMonthlyReportTotals', async () => {
    expect(
      await captureSql('getRevenueGroupsMonthlyReportTotals', monthlyParams),
    ).toMatchSnapshot();
  });

  it('getTotalItems', async () => {
    expect(await captureSql('getTotalItems', {})).toMatchSnapshot();
  });

  it('getTotalCategories', async () => {
    expect(await captureSql('getTotalCategories', {})).toMatchSnapshot();
  });
});
