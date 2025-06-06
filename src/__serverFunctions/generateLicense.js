const {v4: uuidv4} = require('uuid');

// This function is the endpoint's request handler.
exports = async function generateLicense({query, headers, body}, response) {
  try {
    // Data can be extracted from the request as follows:

    // Query params, e.g. '?arg1=hello&arg2=world' => {arg1: "hello", arg2: "world"}
    const {arg1, arg2} = query;

    // Headers, e.g. {"Content-Type": ["application/json"]}
    const contentTypes = headers['Content-Type'];

    // Raw request body (if the client sent one).
    // This is a binary object that can be accessed as a string using .text()
    const reqBody = JSON.parse(body.text());

    console.log('arg1, arg2: ', arg1, arg2);
    console.log('Content-Type:', JSON.stringify(contentTypes));
    console.log('Request body:', reqBody);
    console.log('req.body: ', body);

    // You can use 'context' to interact with other application features.
    // Accessing a value:
    // var x = context.values.get("value_name");

    // Querying a mongodb service:
    // const doc = context.services.get("mongodb-atlas").db("dbname").collection("coll_name").findOne();

    // Calling a function:
    // const result = context.functions.execute("function_name", arg1, arg2);

    let expirationDate = null;
    let durationLength = reqBody.durationLength || 30; // 30 days by default

    if (reqBody.durationType === 'exact-date') {
      durationLength = null; // duration length field is not needed if exact date duration type

      if (!reqBody.exactExpirationDate) {
        throw new Error(
          'Duration type exact-date needs exactExpirationDate value on request body.',
        );
      }

      if (new Date(reqBody.exactExpirationDate) == 'Invalid Date') {
        throw new Error(
          'The given exactExipirationDate value from request body is an invalid date. Please use the format: yyyy:mm:dd hh:mm:ss',
        );
      }

      expirationDate = new Date(reqBody.exactExpirationDate?.toString());
    }

    const licenseKey = uuidv4();
    const keyPair = uuidv4();
    const license = {
      licenseKey,
      keyPair,
      generationDate: new Date(),
      adminUID: reqBody.adminUID || null,
      adminDeviceUID: reqBody.adminDeviceUID || null,
      durationType: reqBody.durationType || 'per-day', //' 'per-day', 'exact-date', 'per-min-test' (for testing only, 5 mins token expiration)
      durationLength,
      expirationDate, // if durationType is 'exact-date'
      costPerDuration: reqBody.costPerDuration || 0,
      appConfigJSON: reqBody.appConfig ? JSON.stringify(reqBody.appConfig) : '',
      remarks: reqBody.remarks || '',
    };

    const {insertedId} = await context.services
      .get('Cluster0')
      .db('FCMSDatabase')
      .collection('licenses')
      .insertOne({...license});

    response.setStatusCode(201);

    // The return value of the function is sent as the response back to the client
    // when the "Respond with Result" setting is set.
    response.setBody(
      JSON.stringify({
        insertedId,
        message: 'License key successfully generated.',
      }),
    );
  } catch (error) {
    response.setStatusCode(400);
    response.setBody(error.message);
  }
};
