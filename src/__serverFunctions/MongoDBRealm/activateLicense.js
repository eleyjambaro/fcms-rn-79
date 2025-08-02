const jwt = require('jsonwebtoken');

// This function is the endpoint's request handler.
exports = async function activateLicense({query, headers, body}, response) {
  try {
    // Data can be extracted from the request as follows:

    // Query params, e.g. '?arg1=hello&arg2=world' => {arg1: "hello", arg2: "world"}
    const {arg1, arg2} = query;

    // Headers, e.g. {"Content-Type": ["application/json"]}
    const contentTypes = headers['Content-Type'];

    // Raw request body (if the client sent one).
    // This is a binary object that can be accessed as a string using .text()
    const reqBody = JSON.parse(body.text());

    // You can use 'context' to interact with other application features.
    // Accessing a value:
    // var x = context.values.get("value_name");

    // Querying a mongodb service:
    // const doc = context.services.get("mongodb-atlas").db("dbname").collection("coll_name").findOne();

    // Calling a function:
    // const result = context.functions.execute("function_name", arg1, arg2);

    const {
      licenseKey,
      localAuthToken,
      deviceUID,
      accountUID,
      companyUID,
      localAccounts,
      localCompanies,
    } = reqBody;

    if (
      !licenseKey ||
      !localAuthToken ||
      !deviceUID ||
      !accountUID ||
      !companyUID ||
      !localAccounts ||
      !localCompanies
    ) {
      throw new Error('Incomplete request body.');
    }

    /**
     * Validate accounts and companies json
     */
    if (!localAccounts?.length > 0) {
      throw new Error('Invalid accounts param.');
    }

    if (!localCompanies?.length > 0) {
      throw new Error('Invalid companies param.');
    }

    const accountsJSON = JSON.stringify({localAccounts});
    const companiesJSON = JSON.stringify({localCompanies});

    /**
     * Validate local auth token
     */
    const decoded = jwt.verify(localAuthToken, `${deviceUID}`);

    if (!decoded) {
      throw Error('Failed to decode auth token.');
    }

    const {account_uid} = decoded;

    if (!account_uid) {
      throw new Error('Invalid token. Missing account_uid payload.');
    }

    /**
     * Get license
     */
    const licenseDoc = await context.services
      .get('Cluster0')
      .db('FCMSDatabase')
      .collection('licenses')
      .findOne({licenseKey: licenseKey});

    if (!licenseDoc) {
      throw new Error('License not found.');
    }

    /**
     * Validate license
     */
    if (!licenseDoc.keyPair) {
      throw new Error('Invalid license.');
    }

    // check if license was already activated
    if (licenseDoc.accountUID) {
      // if true, it means the user is trying to activate a license that is already used or activated

      console.log('licenseDoc.accountUID', licenseDoc.accountUID);
      console.log('account_uid', account_uid);
      console.log('typeof licenseDoc.accountUID', typeof licenseDoc.accountUID);
      console.log('typeof account_uid', typeof account_uid);

      // check if the user account is the owner of the activated license
      if (licenseDoc.accountUID == account_uid) {
        // if true, it means the user is trying to activate their own license which is already activated or expired

        /**
         * TODO: Check if license is already expired, if so, then throw an error
         */
        response.setStatusCode(201);
        response.setBody(
          JSON.stringify({
            message: 'License has already activated.',
            apiVersion: 1,
            lt: licenseDoc.licenseToken,
            kp: licenseDoc.keyPair,
          }),
        );

        return;
      }

      throw new Error('License was already activated or expired.');
    }

    /**
     * Activate license
     */
    let durationLength = licenseDoc.durationLength;
    let expirationDateInMs = new Date().getTime() + 1000 * 60 * 60 * 24 * 30; // 30 days expiration token by default
    let jwtExpiresIn = '30d'; // 30 days default

    if (licenseDoc.durationType === 'per-day') {
      const numberOfdays = durationLength;
      expirationDateInMs =
        new Date().getTime() + 1000 * 60 * 60 * 24 * numberOfdays;
      jwtExpiresIn = `${numberOfdays}d`;
    } else if (licenseDoc.durationType === 'exact-date') {
      const exactExpirationDate = new Date(licenseDoc.expirationDate);

      if (!exactExpirationDate || exactExpirationDate === 'Invalid Date') {
        throw new Error('Internal error. Invalid exact expiration date');
      }

      expirationDateInMs = exactExpirationDate?.getTime();

      if (!expirationDateInMs) {
        throw new Error(
          'Internal error. Invalid exact expiration date in milliseconds',
        );
      }
      // set jwtExpiresIn to null to use expirationDateInMs value below instead of jwtExpiresIn
      jwtExpiresIn = null;
    } else if (licenseDoc.durationType === 'per-min') {
      expirationDateInMs = new Date().getTime() + 1000 * 60 * durationLength; // 5 mins for testing
      jwtExpiresIn = `${durationLength}m`;
    }

    const activationDate = new Date();
    const expirationDate = new Date(expirationDateInMs);

    /**
     * Generate license token
     */
    const appConfigParsed = licenseDoc.appConfigJSON
      ? JSON.parse(licenseDoc.appConfigJSON)
      : {};
    const appConfig = {
      insertLimit: 0,
      insertItemLimitPerCategory: 0,
      insertCategoryLimit: 0,
      insertUserLimit: 0,
      enableBackupDataLocally: true,
      enableRecoverDataLocally: true,
      enableExportReports: true,
      ...appConfigParsed,
    };

    const licenseTokenPayload = {
      appConfig,
      metadata: {
        expirationDateInMs,
        expirationDate,
        activationDate,
        generationDate: licenseDoc.generationDate,
      },
    };

    const licenseTokenSecretKey = `${deviceUID}${licenseDoc.keyPair}`;

    /**
     * REF: (from jsonwebtoken docs)
     * expiresIn: expressed in seconds or a string describing a time span vercel/ms.
     * Eg: 60, "2 days", "10h", "7d". A numeric value is interpreted as a seconds count.
     * If you use a string be sure you provide the time units (days, hours, etc),
     * otherwise milliseconds unit is used by default ("120" is equal to "120ms").
     *
     * LINK: https://github.com/auth0/node-jsonwebtoken
     */
    const licenseToken = jwt.sign(licenseTokenPayload, licenseTokenSecretKey, {
      expiresIn: jwtExpiresIn || `${expirationDateInMs || 0}`,
    });

    const updatedLicenseDoc = await context.services
      .get('Cluster0')
      .db('FCMSDatabase')
      .collection('licenses')
      .updateOne(
        {licenseKey: licenseDoc.licenseKey},
        {
          ...licenseDoc,
          accountUID: account_uid,
          companyUID,
          deviceUID,
          accountsJSON,
          companiesJSON,
          activationDate,
          expirationDate,
          durationLength,
          licenseToken,
        },
      );

    response.setStatusCode(201);

    // The return value of the function is sent as the response back to the client
    // when the "Respond with Result" setting is set.
    response.setBody(
      JSON.stringify({
        message: 'License has been successfully activated.',
        apiVersion: 1,
        lt: licenseToken,
        kp: licenseDoc.keyPair,
      }),
    );
  } catch (error) {
    console.error(error);
    console.log(JSON.stringify(error));
    response.setStatusCode(400);
    response.setBody(error?.message);
  }
};
