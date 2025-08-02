const functions = require('firebase-functions');
const admin = require('firebase-admin');
const {v4: uuidv4} = require('uuid');

admin.initializeApp();
const db = admin.firestore();

exports.generateLicense = functions.https.onRequest(async (req, res) => {
  try {
    if (req.method !== 'POST') {
      return res.status(405).send('Method Not Allowed');
    }

    const reqBody = req.body;

    console.log('Request body:', reqBody);

    let expirationDate = null;
    let durationLength = reqBody.durationLength || 30;

    if (reqBody.durationType === 'exact-date') {
      durationLength = null;

      if (!reqBody.exactExpirationDate) {
        throw new Error(
          'Duration type exact-date needs exactExpirationDate value on request body.',
        );
      }

      const parsedDate = new Date(reqBody.exactExpirationDate.toString());

      if (isNaN(parsedDate.getTime())) {
        throw new Error(
          'The given exactExpirationDate is invalid. Please use format: yyyy-mm-dd hh:mm:ss',
        );
      }

      expirationDate = parsedDate;
    }

    const licenseKey = uuidv4();
    const keyPair = uuidv4();

    const license = {
      licenseKey,
      keyPair,
      generationDate: new Date(),
      adminUID: reqBody.adminUID || null,
      adminDeviceUID: reqBody.adminDeviceUID || null,
      durationType: reqBody.durationType || 'per-day',
      durationLength,
      expirationDate: expirationDate || null,
      costPerDuration: reqBody.costPerDuration || 0,
      appConfigJSON: reqBody.appConfig ? JSON.stringify(reqBody.appConfig) : '',
      remarks: reqBody.remarks || '',
    };

    const docRef = await db.collection('licenses').add(license);

    return res.status(201).json({
      insertedId: docRef.id,
      message: 'License key successfully generated.',
    });
  } catch (err) {
    console.error('generateLicense error:', err);
    return res.status(400).send(err.message || 'Unexpected error');
  }
});
