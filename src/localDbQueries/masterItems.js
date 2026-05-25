import {getDBConnection} from '../localDb';

/**
 * Paginated list of master items in the active company DB that have NOT yet
 * been linked to an `items` row in the current branch. Used by the
 * SelectMasterItem picker so the user can only attach a master once per
 * branch — re-attaching would create duplicate
 * (branch_id, master_item_sync_id) rows.
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

  const whereClauses = [
    `NOT EXISTS (
      SELECT 1 FROM active_items i
      WHERE i.master_item_sync_id = mi.sync_id
    )`,
  ];
  const params = [];
  if (search) {
    whereClauses.push('(UPPER(mi.sku) LIKE UPPER(?) OR UPPER(mi.description) LIKE UPPER(?))');
    params.push(like, like);
  }
  const whereSql = `WHERE ${whereClauses.join(' AND ')}`;

  const totalResult = await db.executeSql(
    `SELECT COUNT(*) AS total FROM active_master_items mi ${whereSql}`,
    params,
  );
  const totalItems = totalResult[0].rows.item(0).total ?? 0;
  const totalPages = totalItems === 0 ? 1 : Math.ceil(totalItems / limit);

  const rowsResult = await db.executeSql(
    `SELECT mi.id, mi.sync_id, mi.sku, mi.description, mi.updated_at
     FROM active_master_items mi
     ${whereSql}
     ORDER BY mi.description COLLATE NOCASE ASC, mi.sku COLLATE NOCASE ASC
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
