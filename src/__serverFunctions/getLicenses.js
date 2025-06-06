const jwt = require('jsonwebtoken');

// This function is the endpoint's request handler.
exports = async function getLicenses({query, headers, body}, response) {
  try {
    // Data can be extracted from the request as follows:

    // Query params, e.g. '?arg1=hello&arg2=world' => {arg1: "hello", arg2: "world"}
    const {arg1, arg2} = query;

    /**
     * Get licenses
     */
    const findResult = await context.services
      .get('Cluster0')
      .db('FCMSDatabase')
      .collection('licenses')
      .find({})
      .limit(10)
      .sort({generationDate: -1});

    let data = [];

    for await (let doc of findResult) {
      data.push(doc);
    }

    response.setStatusCode(201);

    // The return value of the function is sent as the response back to the client
    // when the "Respond with Result" setting is set.
    response.setBody(
      JSON.stringify({
        message: 'Fetched licenses.',
        apiVersion: 1,
        data,
      }),
    );
  } catch (error) {
    console.error(error);
    console.log(JSON.stringify(error));
    response.setStatusCode(400);
    response.setBody(error?.message);
  }
};
