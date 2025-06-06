import getAppConfig from '../constants/appConfig';
import {getDBConnection} from '../localDb';
import {isInsertLimitReached} from '../utils/localDbQueryHelpers';

export const getExpenseGroups = async ({queryKey, pageParam = 1}) => {
  const [_key, {filter, dateFilter}] = queryKey;
  const limit = 1000000000;
  const orderBy = '';
  let queryFilterObj = {...filter};
  let queryFilter = '';

  if (queryFilterObj && Object.keys(queryFilterObj).length > 0) {
    for (let key in queryFilterObj) {
      if (queryFilterObj[key] === '') {
        delete queryFilterObj[key];
      } else {
        let value =
          typeof queryFilterObj[key] === 'string'
            ? `'${queryFilterObj[key]}'`
            : queryFilterObj[key];
        queryFilter = queryFilter
          ? (queryFilter += `AND ${key} = ${value} `)
          : `WHERE ${key} = ${value} `;
      }
    }
  }

  try {
    const db = await getDBConnection();
    const expenseGroups = [];
    const offset = (pageParam - 1) * limit;
    const queryOrderBy = orderBy ? `ORDER BY ${orderBy} DESC` : '';
    const selectQuery = `
      SELECT *,
      e.expense_group_grand_total AS total_expense,
      expense_groups.id AS id
    `;
    const countAllQuery = `SELECT COUNT(*) `;
    const query = `
      FROM expense_groups
      LEFT JOIN (
        SELECT expenses.expense_group_id,
        SUM(expenses.amount) AS expense_group_grand_total
        FROM expenses
        WHERE strftime('%m %Y', expenses.expense_group_date) = strftime('%m %Y', '${dateFilter}')
        GROUP BY expenses.expense_group_id
      ) AS e
      ON e.expense_group_id = expense_groups.id

      ${queryFilter}

      ${queryOrderBy}

      LIMIT ${limit} OFFSET ${offset}
    ;`;

    const results = await db.executeSql(selectQuery + query);
    const totalCountResult = await db.executeSql(countAllQuery + query);
    const totalCount = totalCountResult?.[0]?.rows?.raw()?.[0]?.['COUNT(*)'];

    results.forEach(result => {
      for (let index = 0; index < result.rows.length; index++) {
        expenseGroups.push(result.rows.item(index));
      }
    });

    return {
      page: pageParam,
      result: expenseGroups,
      totalCount,
    };
  } catch (error) {
    console.debug(error);
    throw Error('Failed to get expense groups.');
  }
};

export const getExpenseGroupsGrandTotal = async ({queryKey}) => {
  const [_key, {dateFilter}] = queryKey;

  try {
    const db = await getDBConnection();
    const countAllQuery = `SELECT SUM(expenses.amount) AS expense_groups_grand_total`;
    const query = `
      FROM expenses
      WHERE strftime('%m %Y', expenses.expense_group_date) = strftime('%m %Y', '${dateFilter}')`;

    const result = await db.executeSql(countAllQuery + query);
    const grandTotal = result[0].rows.raw()[0]['expense_groups_grand_total'];

    return grandTotal;
  } catch (error) {
    console.debug(error);
    throw Error('Failed to get expense groups grand total.');
  }
};

export const getExpenseGroupGrandTotal = async ({queryKey}) => {
  const [_key, {expenseGroupId, dateFilter}] = queryKey;

  try {
    const db = await getDBConnection();
    const countAllQuery = `SELECT SUM(expenses.amount) AS expenses_grand_total`;
    const query = `
      FROM expenses
      WHERE strftime('%m %Y', expense_group_date) = strftime('%m %Y', '${dateFilter}')
      AND expense_group_id = ${expenseGroupId}
    `;

    const result = await db.executeSql(countAllQuery + query);
    const grandTotal = result[0].rows.raw()[0]['expenses_grand_total'];

    return grandTotal;
  } catch (error) {
    console.debug(error);
    throw Error('Failed to get expenses grand total.');
  }
};

export const getExpenseGroup = async ({queryKey}) => {
  const [_key, {id}] = queryKey;
  const query = `SELECT * FROM expense_groups WHERE id = ${id}`;

  try {
    const db = await getDBConnection();
    const result = await db.executeSql(query);

    return {
      result: result[0].rows.item(0),
    };
  } catch (error) {
    console.debug(error);
    throw Error('Failed to fetch expense group.');
  }
};

export const createExpenseGroup = async ({values, onInsertLimitReached}) => {
  const query = `INSERT INTO expense_groups (
    name
  )
  
  VALUES(
    '${values.name.replace(/\'/g, "''")}'
  );`;

  try {
    const db = await getDBConnection();
    const appConfig = await getAppConfig();
    const insertLimit = appConfig.insertLimit;

    if (
      insertLimit > 0 &&
      (await isInsertLimitReached('expense_groups', insertLimit))
    ) {
      onInsertLimitReached &&
        onInsertLimitReached({
          insertLimit,
          message: `You can only create up to ${insertLimit} expense groups`,
        });
      console.debug('Failed to create expense group, insert limit reached.');

      return;
    }

    const result = await db.executeSql(query);
  } catch (error) {
    console.debug(error);
    throw Error('Failed to create expense group.');
  }
};

export const updateExpenseGroup = async ({id, updatedValues}) => {
  const query = `UPDATE expense_groups
    SET name = '${updatedValues.name.replace(/\'/g, "''")}'
    WHERE id = ${id}
  `;

  try {
    const db = await getDBConnection();
    return await db.executeSql(query);
  } catch (error) {
    console.debug(error);
    throw Error('Failed to update expense group.');
  }
};

export const deleteExpenseGroup = async ({id}) => {
  const deleteExpenseGroupQuery = `DELETE FROM expense_groups WHERE id = ${id}`;
  const deleteMonthlyExpenseEntriesQuery = `DELETE FROM expenses WHERE expense_group_id = ${id}`;

  try {
    const db = await getDBConnection();

    const deleteExpenseGroupResult = await db.executeSql(
      deleteExpenseGroupQuery,
    );

    if (deleteExpenseGroupResult[0].rowsAffected > 0) {
      await db.executeSql(deleteMonthlyExpenseEntriesQuery);
    }
  } catch (error) {
    console.debug(error);
    throw Error('Failed to delete expense group.');
  }
};

export const getMonthlyExpenses = async ({queryKey, pageParam = 1}) => {
  const [_key, {filter, dateFilter, expenseGroupId}] = queryKey;
  const limit = 1000000000;
  const orderBy = '';
  let queryFilterObj = {...filter};
  let queryFilter = '';

  if (queryFilterObj && Object.keys(queryFilterObj).length > 0) {
    for (let key in queryFilterObj) {
      if (queryFilterObj[key] === '') {
        delete queryFilterObj[key];
      } else {
        let value =
          typeof queryFilterObj[key] === 'string'
            ? `'${queryFilterObj[key]}'`
            : queryFilterObj[key];
        queryFilter = queryFilter
          ? (queryFilter += `AND ${key} = ${value} `)
          : `WHERE ${key} = ${value} `;
      }
    }
  }

  try {
    const db = await getDBConnection();
    const monthlyExpenses = [];
    const offset = (pageParam - 1) * limit;
    const queryOrderBy = orderBy ? `ORDER BY ${orderBy} DESC` : '';
    const selectQuery = `
      SELECT *,
      monthly_expenses.id AS id,
      r.id AS expense_id,
      r.amount AS total_amount
    `;
    const countAllQuery = `SELECT COUNT(*) `;
    const query = `
      FROM monthly_expenses
      LEFT JOIN (
        SELECT * FROM expenses
        WHERE strftime('%m %Y', expenses.expense_group_date) = strftime('%m %Y', '${dateFilter}')
        AND expenses.expense_group_id = ${expenseGroupId}
      ) AS r
      ON r.monthly_expense_id = monthly_expenses.id
      WHERE monthly_expenses.expense_group_id = ${expenseGroupId}

      ${queryFilter}

      ${queryOrderBy}

      LIMIT ${limit} OFFSET ${offset}
    ;`;

    const results = await db.executeSql(selectQuery + query);
    const totalCountResult = await db.executeSql(countAllQuery + query);
    const totalCount = totalCountResult?.[0]?.rows?.raw()?.[0]?.['COUNT(*)'];

    results.forEach(result => {
      for (let index = 0; index < result.rows.length; index++) {
        monthlyExpenses.push(result.rows.item(index));
      }
    });

    return {
      page: pageParam,
      result: monthlyExpenses,
      totalCount,
    };
  } catch (error) {
    console.debug(error);
    throw Error('Failed to get monthly expenses.');
  }
};

export const getMonthlyExpensesTotalAmount = async () => {
  try {
    const db = await getDBConnection();
    const monthlyExpensesTotalAmount = [];

    const selectQuery = `
      SELECT monthly_expense_id, SUM(amount) AS total_amount
    `;
    const query = `
      FROM expenses
      GROUP BY monthly_expense_id
    ;`;

    const results = await db.executeSql(selectQuery + query);

    results.forEach(result => {
      for (let index = 0; index < result.rows.length; index++) {
        monthlyExpensesTotalAmount.push(result.rows.item(index));
      }
    });

    return {
      result: monthlyExpensesTotalAmount,
    };
  } catch (error) {
    console.debug(error);
    throw Error('Failed to get monthly expenses total amount.');
  }
};

export const getMonthlyExpensesGrandTotal = async ({queryKey}) => {
  const [_key, {dateFilter}] = queryKey;

  try {
    const db = await getDBConnection();
    const countAllQuery = `SELECT SUM(expenses.amount) AS expense_groups_grand_total`;
    const query = `
      FROM expenses
      WHERE strftime('%m %Y', expenses.expense_group_date) = strftime('%m %Y', '${dateFilter}')`;

    const result = await db.executeSql(countAllQuery + query);
    const grandTotal = result[0].rows.raw()[0]['expense_groups_grand_total'];

    return grandTotal;
  } catch (error) {
    console.debug(error);
    throw Error('Failed to get expense groups grand total.');
  }
};

export const getMonthlyExpenseGrandTotal = async ({queryKey}) => {
  const [_key, {expenseGroupId, dateFilter}] = queryKey;

  try {
    const db = await getDBConnection();
    const countAllQuery = `SELECT SUM(expenses.amount) AS expenses_grand_total`;
    const query = `
      FROM expenses
      WHERE strftime('%m %Y', expense_group_date) = strftime('%m %Y', '${dateFilter}')
      AND expense_group_id = ${expenseGroupId}
      `;

    const result = await db.executeSql(countAllQuery + query);
    const grandTotal = result[0].rows.raw()[0]['expenses_grand_total'];

    return grandTotal;
  } catch (error) {
    console.debug(error);
    throw Error('Failed to get expenses grand total.');
  }
};

export const getMonthlyExpense = async ({queryKey}) => {
  const [_key, {id}] = queryKey;
  const query = `SELECT * FROM monthly_expenses WHERE id = ${id}`;

  try {
    const db = await getDBConnection();
    const result = await db.executeSql(query);

    return {
      result: result[0].rows.item(0),
    };
  } catch (error) {
    console.debug(error);
    throw Error('Failed to fetch monthly expense.');
  }
};

export const getExpenseRevenueGroupIds = async ({queryKey}) => {
  const [_key, {id}] = queryKey;
  const getExpenseRevenueGroupIdsQuery = `
    SELECT *
    FROM revenue_deductions
    WHERE expense_id = ${id}
  `;

  try {
    const db = await getDBConnection();
    let expenseRevenueGroupIds = [];
    const results = await db.executeSql(getExpenseRevenueGroupIdsQuery);
    results.forEach(result => {
      for (let index = 0; index < result.rows.length; index++) {
        expenseRevenueGroupIds.push(result.rows.item(index)?.revenue_group_id);
      }
    });

    return {
      result: expenseRevenueGroupIds,
    };
  } catch (error) {
    console.debug(error);
    throw Error(`Failed to fetch expense revenue group ID's.`);
  }
};

export const createMonthlyExpense = async ({values}) => {
  try {
    const db = await getDBConnection();

    const createMonthlyExpenseQuery = `INSERT INTO monthly_expenses (
      expense_group_id,
      name
    )
  
    VALUES(
      ${parseInt(values.expense_group_id)},
      '${values.name}'
    );`;

    if (!values?.revenue_group_ids?.length > 0) {
      throw Error('Monthly expense must have at least one revenue group id');
    }

    const createMonthlyExpenseResult = await db.executeSql(
      createMonthlyExpenseQuery,
    );
    const monthlyExpenseId = createMonthlyExpenseResult[0].insertId;

    // insert each revenue groups to revenue_deductions table
    let insertRevenueDeductionsQuery = `
      INSERT INTO revenue_deductions (
        revenue_group_id,
        monthly_expense_id
      )
      
      VALUES
    `;

    values.revenue_group_ids.forEach((revenueGroupId, index) => {
      insertRevenueDeductionsQuery += `(
          ${revenueGroupId},
          ${monthlyExpenseId}
          
        )`;

      if (values.revenue_group_ids.length - 1 !== index) {
        insertRevenueDeductionsQuery += `,
            `;
      } else {
        insertRevenueDeductionsQuery += ';';
      }
    });

    await db.executeSql(insertRevenueDeductionsQuery);
  } catch (error) {
    console.debug(error);
    throw Error('Failed to create monthly expense.');
  }
};

export const updateMonthlyExpense = async ({id, updatedValues}) => {
  try {
    const db = await getDBConnection();

    const updateMonthlyExpenseQuery = `UPDATE monthly_expenses
      SET name = '${updatedValues.name}'
      WHERE id = ${id}
    `;

    if (!updatedValues?.revenue_group_ids?.length > 0) {
      throw Error('Monthly expense must have at least one revenue group id');
    }

    const updateMonthlyExpenseResult = await db.executeSql(
      updateMonthlyExpenseQuery,
    );

    const deleteExistingRevenueDeductionsQuery = `
      DELETE FROM revenue_deductions WHERE monthly_expense_id = ${id};
    `;

    await db.executeSql(deleteExistingRevenueDeductionsQuery);

    // insert each new revenue groups to revenue_deductions table
    let insertRevenueDeductionsQuery = `
      INSERT INTO revenue_deductions (
        revenue_group_id,
        monthly_expense_id
      )
      
      VALUES
    `;

    updatedValues.revenue_group_ids.forEach((revenueGroupId, index) => {
      insertRevenueDeductionsQuery += `(
          ${revenueGroupId},
          ${id}
        )`;

      if (updatedValues.revenue_group_ids.length - 1 !== index) {
        insertRevenueDeductionsQuery += `,
            `;
      } else {
        insertRevenueDeductionsQuery += ';';
      }
    });

    await db.executeSql(insertRevenueDeductionsQuery);
  } catch (error) {
    console.debug(error);
    throw Error('Failed to update expense.');
  }
};

export const deleteMonthlyExpense = async ({id}) => {
  const deleteMonthlyExpenseQuery = `DELETE FROM monthly_expenses WHERE id = ${id}`;
  const deleteExpensesQuery = `DELETE FROM expenses WHERE monthly_expense_id = ${id}`;

  try {
    const db = await getDBConnection();

    const deleteMonthlyExpenseResult = await db.executeSql(
      deleteMonthlyExpenseQuery,
    );

    if (deleteMonthlyExpenseResult[0].rowsAffected > 0) {
      await db.executeSql(deleteExpensesQuery);
    }
  } catch (error) {
    console.debug(error);
    throw Error('Failed to delete monthly expense.');
  }
};

export const getExpenses = async ({queryKey, pageParam = 1}) => {
  const [_key, {filter, dateFilter, expenseGroupId}] = queryKey;
  const limit = 1000000000;
  const orderBy = '';
  let queryFilterObj = {...filter};
  let queryFilter = '';

  if (queryFilterObj && Object.keys(queryFilterObj).length > 0) {
    for (let key in queryFilterObj) {
      if (queryFilterObj[key] === '') {
        delete queryFilterObj[key];
      } else {
        let value =
          typeof queryFilterObj[key] === 'string'
            ? `'${queryFilterObj[key]}'`
            : queryFilterObj[key];
        queryFilter = queryFilter
          ? (queryFilter += `AND ${key} = ${value} `)
          : `WHERE ${key} = ${value} `;
      }
    }
  }

  try {
    const db = await getDBConnection();
    const expenses = [];
    const offset = (pageParam - 1) * limit;
    const queryOrderBy = orderBy ? `ORDER BY ${orderBy} DESC` : '';
    const selectQuery = `
      SELECT *
    `;
    const countAllQuery = `SELECT COUNT(*) `;
    const query = `
      FROM expenses
      WHERE expense_group_id = ${expenseGroupId}
      AND strftime('%m %Y', expense_group_date) = strftime('%m %Y', '${dateFilter}')

      ${queryFilter}

      ${queryOrderBy}

      LIMIT ${limit} OFFSET ${offset}
    ;`;

    const results = await db.executeSql(selectQuery + query);
    const totalCountResult = await db.executeSql(countAllQuery + query);
    const totalCount = totalCountResult?.[0]?.rows?.raw()?.[0]?.['COUNT(*)'];

    results.forEach(result => {
      for (let index = 0; index < result.rows.length; index++) {
        expenses.push(result.rows.item(index));
      }
    });

    return {
      page: pageParam,
      result: expenses,
      totalCount,
    };
  } catch (error) {
    console.debug(error);
    throw Error('Failed to get expenses.');
  }
};

export const getExpensesGrandTotal = async ({queryKey}) => {
  const [_key, {expenseGroupId, dateFilter}] = queryKey;

  try {
    const db = await getDBConnection();
    const countAllQuery = `SELECT SUM(expenses.amount) AS expenses_grand_total`;
    const query = `
      FROM expenses
      WHERE strftime('%m %Y', expense_group_date) = strftime('%m %Y', '${dateFilter}')
      AND expense_group_id = ${expenseGroupId}
      `;

    const result = await db.executeSql(countAllQuery + query);
    const grandTotal = result[0].rows.raw()[0]['expenses_grand_total'];

    return grandTotal;
  } catch (error) {
    console.debug(error);
    throw Error('Failed to get expenses grand total.');
  }
};

export const createExpense = async ({values, onInsertLimitReached}) => {
  try {
    const db = await getDBConnection();
    const appConfig = await getAppConfig();
    const insertLimit = appConfig.insertLimit;

    if (
      insertLimit > 0 &&
      (await isInsertLimitReached('expenses', insertLimit))
    ) {
      onInsertLimitReached &&
        onInsertLimitReached({
          insertLimit,
          message: `You can only create up to ${insertLimit} expenses`,
        });
      console.debug('Failed to create expense, insert limit reached.');

      return;
    }

    if (!values?.revenue_group_ids?.length > 0) {
      throw Error('Expense must have at least one revenue group id');
    }

    const createExpenseQuery = `
      INSERT INTO expenses (
        expense_group_id,
        expense_group_date,
        name,
        amount
      )
      
      VALUES(
        ${values.expense_group_id},
        '${values.expense_group_date}',
        '${values.name}',
        ${values.amount}
      );
    `;

    const createExpenseResult = await db.executeSql(createExpenseQuery);

    if (createExpenseResult[0].rowsAffected === 0) {
      throw Error('Failed to create new expense');
    }

    const expenseId = createExpenseResult[0].insertId;

    // insert each revenue group ids to revenue_deductions table
    let insertRevenueDeductionsQuery = `
      INSERT INTO revenue_deductions (
        revenue_group_id,
        expense_id
      )
      
      VALUES
    `;

    values.revenue_group_ids.forEach((revenueGroupId, index) => {
      insertRevenueDeductionsQuery += `(
          ${revenueGroupId},
          ${expenseId}
          
        )`;

      if (values.revenue_group_ids.length - 1 !== index) {
        insertRevenueDeductionsQuery += `,
            `;
      } else {
        insertRevenueDeductionsQuery += ';';
      }
    });

    await db.executeSql(insertRevenueDeductionsQuery);
  } catch (error) {
    console.debug(error);
    throw Error('Failed to create expense.');
  }
};

export const getExpense = async ({queryKey}) => {
  const [_key, {id}] = queryKey;
  const query = `SELECT * FROM expenses WHERE id = ${id}`;

  try {
    const db = await getDBConnection();
    const result = await db.executeSql(query);

    return {
      result: result[0].rows.item(0),
    };
  } catch (error) {
    console.debug(error);
    throw Error('Failed to fetch expense.');
  }
};

export const updateExpense = async ({id, updatedValues}) => {
  if (!updatedValues?.revenue_group_ids?.length > 0) {
    throw Error('Expense must have at least one revenue group id');
  }

  const updateExpenseQuery = `UPDATE expenses
    SET name = '${updatedValues.name}',
    amount = ${updatedValues.amount}
    WHERE id = ${id}
  `;

  try {
    const db = await getDBConnection();
    const updateExpenseResult = await db.executeSql(updateExpenseQuery);

    if (updateExpenseResult[0].rowsAffected === 0) {
      throw Error('Failed to update expense.');
    }

    const deleteExistingRevenueDeductionsQuery = `
      DELETE FROM revenue_deductions WHERE expense_id = ${id};
    `;

    await db.executeSql(deleteExistingRevenueDeductionsQuery);

    // insert each new revenue groups to revenue_deductions table
    let insertRevenueDeductionsQuery = `
      INSERT INTO revenue_deductions (
        revenue_group_id,
        expense_id
      )

      VALUES
      `;

    updatedValues.revenue_group_ids.forEach((revenueGroupId, index) => {
      insertRevenueDeductionsQuery += `(
        ${revenueGroupId},
        ${id}
      )`;

      if (updatedValues.revenue_group_ids.length - 1 !== index) {
        insertRevenueDeductionsQuery += `,
      `;
      } else {
        insertRevenueDeductionsQuery += ';';
      }
    });

    await db.executeSql(insertRevenueDeductionsQuery);
  } catch (error) {
    console.debug(error);
    throw Error('Failed to update expense.');
  }
};

export const deleteExpense = async ({id}) => {
  const query = `DELETE FROM expenses WHERE id = ${id}`;

  try {
    const db = await getDBConnection();
    return await db.executeSql(query);
  } catch (error) {
    console.debug(error);
    throw Error('Failed to delete expense.');
  }
};
