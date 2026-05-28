// Legacy Firebase endpoints used to live here. The licensing endpoints now
// live on the FCMS API (Sanctum-authenticated, RS256 JWTs) and the client
// reaches them via the cloudApiV2 axios instance — see
// src/serverDbQueries/v2/licenses.js.
//
// This file is kept as a placeholder so any straggling imports continue to
// resolve; it should be deleted once all references are confirmed gone.

export const endpoints = {};

export default endpoints;
