/**
 * Characterization (golden-master) test for the report-style SELECTs in
 * endingInventory.js and spoilages.js.
 *
 * These two files share the same per-period totals SQL as reports.js and carried
 * the same `previous_month_total_*_stock_qty` copy-paste bug (qty column fed from
 * the `*_cost` source). That bug was just corrected to read the real `*_qty`
 * source. Unlike reports.js these files had no regression net, so this test locks
 * their generated SQL (post-fix) so the fix — and the surrounding SQL — can't
 * silently drift again.
 *
 * Mechanics mirror reportsSqlBuilders.test.js: getDBConnection is faked to record
 * the SQL instead of running it; the assorted native/service deps these modules
 * import are stubbed so they load under the `react-native` jest preset.
 *
 * Note: `createItemEndingInventoryEntry` is a write function whose SELECT runs
 * first; under the empty mocked DB it then dereferences an undefined row and
 * throws before the INSERT, so `captureSql` is tolerant and we snapshot only the
 * captured SELECT (the INSERT would carry non-deterministic uuids/timestamps).
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
  getCloudSyncParams: jest.fn(async () => ({})),
  OPERATION_DEFAULT_UUIDS: {},
}));

jest.mock('../src/localDbQueries/revenues', () => ({
  buildRevenueGroupMonthTotalSql: jest.fn(
    ({groupIdSql, dateSql}) => `RG_TOTAL(group=${groupIdSql} date=${dateSql})`,
  ),
}));

jest.mock('../src/services/syncService', () => ({
  scheduleSyncSoon: jest.fn(),
}));

jest.mock('../src/constants/appConfig', () => ({
  __esModule: true,
  default: () => ({}),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async () => null),
    setItem: jest.fn(async () => {}),
  },
}));

jest.mock('react-native-uuid', () => ({
  __esModule: true,
  default: {v4: () => 'test-uuid'},
}));

const endingInventory = require('../src/localDbQueries/endingInventory');
const spoilages = require('../src/localDbQueries/spoilages');

const normalizeSql = sql => sql.replace(/\s+/g, ' ').trim();

async function captureSql(run) {
  mockCapturedSqls = [];
  try {
    await run();
  } catch (e) {
    // Some write functions read the SELECT result and then throw under the empty
    // mocked DB — the SELECT we care about is already captured by then.
  }
  return mockCapturedSqls.map(normalizeSql);
}

const DATE_FILTER = '2026-05-01';

const spoilageParams = {
  filter: {'x.flag': 'on'},
  monthYearDateFilter: DATE_FILTER,
  limit: 1000,
  listOrder: 'DESC',
};

// A second date branch (exact date) so the refactor's `selectedEndDate` wiring —
// which flows into BOTH the selected- and previous-month subqueries — is locked,
// not just the month branch.
const spoilageParamsExactDate = {
  filter: {'x.flag': 'on'},
  exactDateFilter: '2026-05-15',
  limit: 1000,
  listOrder: 'DESC',
};

describe('endingInventory.js / spoilages.js generated SQL (golden master)', () => {
  it('createItemEndingInventoryEntry (SELECT)', async () => {
    const sqls = await captureSql(() =>
      endingInventory.createItemEndingInventoryEntry({
        itemId: 'ITEM_X',
        monthYearDateFilter: DATE_FILTER,
        values: {},
        onError: () => {},
      }),
    );
    // First captured statement is the report SELECT (holds the qty-alias fix).
    expect(sqls[0]).toMatchSnapshot();
  });

  it('getSpoilages', async () => {
    expect(
      await captureSql(() =>
        spoilages.getSpoilages({queryKey: ['k', spoilageParams], pageParam: 1}),
      ),
    ).toMatchSnapshot();
  });

  it('getSpoilages (exact date)', async () => {
    expect(
      await captureSql(() =>
        spoilages.getSpoilages({
          queryKey: ['k', spoilageParamsExactDate],
          pageParam: 1,
        }),
      ),
    ).toMatchSnapshot();
  });

  it('getSpoilagesTotal', async () => {
    expect(
      await captureSql(() =>
        spoilages.getSpoilagesTotal({queryKey: ['k', spoilageParams]}),
      ),
    ).toMatchSnapshot();
  });

  it('getSpoilagesTotal (exact date)', async () => {
    expect(
      await captureSql(() =>
        spoilages.getSpoilagesTotal({queryKey: ['k', spoilageParamsExactDate]}),
      ),
    ).toMatchSnapshot();
  });
});
