import {getDBConnection} from '../localDb';
import {
  createQueryFilter,
  isInsertLimitReached,
} from '../utils/localDbQueryHelpers';
import getAppConfig from '../constants/appConfig';

export const getCategories = async ({queryKey, pageParam = 1}) => {
  const [_key, {filter, limit = 1000000000}] = queryKey;
  const orderBy = 'name';
  let queryFilter = createQueryFilter(filter);

  try {
    const db = await getDBConnection();
    const categories = [];
    const offset = (pageParam - 1) * limit;
    const queryOrderBy = orderBy ? `ORDER BY ${orderBy} ASC` : '';
    const selectQuery = `
      SELECT *
    `;
    const countAllQuery = `SELECT COUNT(*) `;
    const query = `
      FROM categories

      ${queryFilter}

      ${queryOrderBy}

      LIMIT ${limit} OFFSET ${offset}
    `;

    const results = await db.executeSql(selectQuery + query);
    const totalCountResult = await db.executeSql(countAllQuery + query);
    const totalCount = totalCountResult?.[0]?.rows?.raw()?.[0]?.['COUNT(*)'];

    results.forEach(result => {
      for (let index = 0; index < result.rows.length; index++) {
        categories.push(result.rows.item(index));
      }
    });

    return {
      page: pageParam,
      result: categories,
      totalCount,
    };
  } catch (error) {
    console.debug(error);
    throw Error('Failed to get categories.');
  }
};

export const createCategory = async ({
  category,
  onInsertLimitReached,
  onFormValidationError,
}) => {
  try {
    const db = await getDBConnection();
    const appConfig = await getAppConfig();
    const insertLimit = appConfig?.insertCategoryLimit;

    if (
      insertLimit > 0 &&
      (await isInsertLimitReached('categories', insertLimit))
    ) {
      onInsertLimitReached &&
        onInsertLimitReached({
          insertLimit,
          message: `You can only create up to ${insertLimit} categories`,
        });
      console.debug('Failed to create category, insert limit reached.');

      return;
    }

    /**
     * Validate category name
     */
    if (!category.name) {
      onFormValidationError &&
        onFormValidationError({
          fieldName: 'name',
          errorMessage: 'Category name is required',
        });
      throw Error('Category name is required');
    }

    const getCategoryByNameQuery = `
      SELECT * FROM categories WHERE name = '${category.name.replace(
        /\'/g,
        "''",
      )}';
    `;

    const getCategoryByNameResult = await db.executeSql(getCategoryByNameQuery);
    const fetchedCategoryByName = getCategoryByNameResult[0].rows.item(0);

    if (fetchedCategoryByName) {
      onFormValidationError &&
        onFormValidationError({
          fieldName: 'name',
          errorMessage: `The name "${fetchedCategoryByName.name}" already exists. Please specify a different name.`,
        });
      throw Error(
        `The name "${fetchedCategoryByName.name}" already exists. Please specify a different name.`,
      );
    }

    /**
     * Insert Category
     */
    const createCategoryQuery = `INSERT INTO categories (
      name
    )
    
    VALUES(
      '${category.name.replace(/\'/g, "''")}'
    );`;

    return db.executeSql(createCategoryQuery);
  } catch (error) {
    console.debug(error);
    throw Error('Failed to create category.');
  }
};

export const getCategory = async ({queryKey}) => {
  const [_key, {id}] = queryKey;
  const query = `SELECT * FROM categories WHERE id = ${id}`;

  try {
    const db = await getDBConnection();
    const result = await db.executeSql(query);

    return {
      result: result[0].rows.item(0),
    };
  } catch (error) {
    console.debug(error);
    throw Error('Failed to fetch category.');
  }
};

export const updateCategory = async ({
  id,
  updatedValues,
  onFormValidationError,
}) => {
  try {
    const db = await getDBConnection();

    /**
     * Validate category name
     */
    if (!updatedValues.name) {
      onFormValidationError &&
        onFormValidationError({
          fieldName: 'name',
          errorMessage: 'Category name is required',
        });
      throw Error('Category name is required');
    }

    const getCategoryByNameQuery = `
      SELECT * FROM categories WHERE name = '${updatedValues.name.replace(
        /\'/g,
        "''",
      )}' AND id != ${id};
    `;

    const getCategoryByNameResult = await db.executeSql(getCategoryByNameQuery);
    const fetchedCategoryByName = getCategoryByNameResult[0].rows.item(0);

    if (fetchedCategoryByName) {
      onFormValidationError &&
        onFormValidationError({
          fieldName: 'name',
          errorMessage: `The name "${fetchedCategoryByName.name}" already exists. Please specify a different name.`,
        });
      throw Error(
        `The name "${fetchedCategoryByName.name}" already exists. Please specify a different name.`,
      );
    }

    /**
     * Update Category
     */
    const updateCategoryQuery = `UPDATE categories
      SET name = '${updatedValues.name.replace(/\'/g, "''")}'
      WHERE id = ${id}
    `;

    return await db.executeSql(updateCategoryQuery);
  } catch (error) {
    console.debug(error);
    throw Error('Failed to update category.');
  }
};

export const deleteCategory = async ({id, onError}) => {
  try {
    const db = await getDBConnection();

    /**
     * Check if category is associated with an item
     */
    const getItemAssociatedWithCategoryQuery = `
      SELECT * FROM items WHERE category_id = ${id}
    `;

    const getItemAssociatedWithCategoryResult = await db.executeSql(
      getItemAssociatedWithCategoryQuery,
    );

    const itemAssociatedWithCategory =
      getItemAssociatedWithCategoryResult[0].rows.item(0);

    if (itemAssociatedWithCategory) {
      onError &&
        onError({
          errorMessage: 'Category associated with an item cannot be deleted.',
        });
      throw Error('Category associated with an item cannot be deleted.');
    }

    const deleteCategoryQuery = `DELETE FROM categories WHERE id = ${id}`;

    return await db.executeSql(deleteCategoryQuery);
  } catch (error) {
    console.debug(error);
    throw Error('Failed to delete category.');
  }
};
