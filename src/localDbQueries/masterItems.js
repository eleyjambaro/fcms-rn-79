import {getDBConnection} from '../localDb';

/**
 * Paginated list of ALL master items in the active company DB, each flagged
 * with `is_in_branch` (1 = already linked to an `items` row in the current
 * branch, 0 = available to register). The SelectMasterItem picker shows every
 * master and grays out / disables the in-branch ones with a badge, rather than
 * hiding them — so users can see the full company catalog while still being
 * blocked from creating duplicate (branch_id, master_item_sync_id) rows.
 *
 * Returns the cloud-envelope shape `{status, data, pagination}` so the picker
 * can reuse the same useInfiniteQuery patterns as the server-backed lists.
 */
export const getLocalMastersAvailableForBranch = async ({
  pageParam = 1,
  queryKey,
}) => {
  const [, {q = '', perPage = 20} = {}] = queryKey ?? [];
  const limit = perPage;
  const offset = (pageParam - 1) * limit;
  const search = q.trim();
  const like = `%${search}%`;

  const db = await getDBConnection();

  const whereClauses = [];
  const params = [];
  if (search) {
    whereClauses.push('(UPPER(mi.sku) LIKE UPPER(?) OR UPPER(mi.description) LIKE UPPER(?))');
    params.push(like, like);
  }
  const whereSql = whereClauses.length
    ? `WHERE ${whereClauses.join(' AND ')}`
    : '';

  const totalResult = await db.executeSql(
    `SELECT COUNT(*) AS total FROM active_master_items mi ${whereSql}`,
    params,
  );
  const totalItems = totalResult[0].rows.item(0).total ?? 0;
  const totalPages = totalItems === 0 ? 1 : Math.ceil(totalItems / limit);

  const rowsResult = await db.executeSql(
    `SELECT mi.id, mi.sync_id, mi.sku, mi.description,
            mi.barcode, mi.uom_abbrev, mi.uom_abbrev_per_piece,
            mi.qty_per_piece, mi.packaging_type, mi.updated_at,
            EXISTS (
              SELECT 1 FROM active_items i
              WHERE i.master_item_sync_id = mi.sync_id
            ) AS is_in_branch
     FROM active_master_items mi
     ${whereSql}
     ORDER BY is_in_branch ASC,
              mi.description COLLATE NOCASE ASC, mi.sku COLLATE NOCASE ASC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );

  const data = [];
  const rows = rowsResult[0].rows;
  for (let i = 0; i < rows.length; i++) {
    data.push(rows.item(i));
  }

  return {
    status: 'success',
    data,
    pagination: {
      current_page: pageParam,
      per_page: limit,
      total_pages: totalPages,
      total_items: totalItems,
    },
  };
};

/**
 * Count of master items in the active company DB that aren't yet linked to
 * an items row in the current branch. Used by SelectAddItemMode to decide
 * which radio option to default to (pick-from-master if any, else
 * register-new).
 */
export const countLocalMastersAvailableForBranch = async () => {
  const db = await getDBConnection();
  const result = await db.executeSql(
    `SELECT COUNT(*) AS total
     FROM active_master_items mi
     WHERE NOT EXISTS (
       SELECT 1 FROM active_items i
       WHERE i.master_item_sync_id = mi.sync_id
     )`,
  );
  return result[0].rows.item(0).total ?? 0;
};
