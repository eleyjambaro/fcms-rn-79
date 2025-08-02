const functions = require('firebase-functions');
const admin = require('firebase-admin');
const jwt = require('jsonwebtoken');

admin.initializeApp();
const db = admin.firestore();

exports.activateLicense = functions.https.onRequest(async (req, res) => {
  try {
    if (req.method !== 'POST') {
      res.status(405).send('Method Not Allowed');
      return;
    }

    const {
      licenseKey,
      localAuthToken,
      deviceUID,
      accountUID,
      companyUID,
      localAccounts,
      localCompanies,
    } = req.body;

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

    if (!Array.isArray(localAccounts) || localAccounts.length === 0) {
      throw new Error('Invalid accounts param.');
    }

    if (!Array.isArray(localCompanies) || localCompanies.length === 0) {
      throw new Error('Invalid companies param.');
    }

    const decoded = jwt.verify(localAuthToken, deviceUID);
    const {account_uid} = decoded;

    if (!account_uid) {
      throw new Error('Invalid token. Missing account_uid payload.');
    }

    const licenseRef = db.collection('licenses').doc(licenseKey);
    const licenseSnap = await licenseRef.get();

    if (!licenseSnap.exists) {
      throw new Error('License not found.');
    }

    const licenseDoc = licenseSnap.data();

    if (!licenseDoc.keyPair) {
      throw new Error('Invalid license.');
    }

    if (licenseDoc.accountUID) {
      if (licenseDoc.accountUID === account_uid) {
        return res.status(201).json({
          message: 'License has already activated.',
          apiVersion: 1,
          lt: licenseDoc.licenseToken,
          kp: licenseDoc.keyPair,
        });
      }

      throw new Error('License was already activated or expired.');
    }

    // Compute expiration
    let durationLength = licenseDoc.durationLength;
    let expirationDateInMs = Date.now() + 1000 * 60 * 60 * 24 * 30;
    let jwtExpiresIn = '30d';

    if (licenseDoc.durationType === 'per-day') {
      expirationDateInMs = Date.now() + 1000 * 60 * 60 * 24 * durationLength;
      jwtExpiresIn = `${durationLength}d`;
    } else if (licenseDoc.durationType === 'exact-date') {
      const date = new Date(licenseDoc.expirationDate);
      if (isNaN(date.getTime())) {
        throw new Error('Invalid exact expiration date.');
      }
      expirationDateInMs = date.getTime();
      jwtExpiresIn = null;
    } else if (licenseDoc.durationType === 'per-min') {
      expirationDateInMs = Date.now() + 1000 * 60 * durationLength;
      jwtExpiresIn = `${durationLength}m`;
    }

    const activationDate = new Date();
    const expirationDate = new Date(expirationDateInMs);

    // Compose license token
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
    const licenseToken = jwt.sign(
      licenseTokenPayload,
      licenseTokenSecretKey,
      jwtExpiresIn ? {expiresIn: jwtExpiresIn} : undefined,
    );

    await licenseRef.update({
      accountUID: account_uid,
      companyUID,
      deviceUID,
      accountsJSON: JSON.stringify({localAccounts}),
      companiesJSON: JSON.stringify({localCompanies}),
      activationDate,
      expirationDate,
      durationLength,
      licenseToken,
    });

    return res.status(201).json({
      message: 'License has been successfully activated.',
      apiVersion: 1,
      lt: licenseToken,
      kp: licenseDoc.keyPair,
    });
  } catch (err) {
    console.error('activateLicense error:', err);
    return res.status(400).send(err.message || 'Unexpected error');
  }
});
