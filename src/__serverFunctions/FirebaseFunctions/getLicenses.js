const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();

exports.getLicenses = functions.https.onRequest(async (req, res) => {
  try {
    if (req.method !== 'GET') {
      return res.status(405).send('Method Not Allowed');
    }

    // Optional query params (if needed)
    const {arg1, arg2} = req.query;
    console.log('Query params:', {arg1, arg2});

    const snapshot = await db
      .collection('licenses')
      .orderBy('generationDate', 'desc')
      .limit(10)
      .get();

    const data = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    return res.status(200).json({
      message: 'Fetched licenses.',
      apiVersion: 1,
      data,
    });
  } catch (error) {
    console.error('getLicenses error:', error);
    return res.status(400).send(error.message || 'Unexpected error');
  }
});
