import {KEYUTIL, KJUR} from 'jsrsasign';

import {licensePublicKeyPem} from '../keys/licensePublicKey';

const ISSUER = 'fcms-api';
const AUDIENCE = 'fcms-app';
const ALGORITHM = 'RS256';
const GRACE_PERIOD_SECONDS = 60;

let cachedPublicKey = null;

const getPublicKey = () => {
  if (!cachedPublicKey) {
    cachedPublicKey = KEYUTIL.getKey(licensePublicKeyPem);
  }
  return cachedPublicKey;
};

const snakeToCamel = key =>
  key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());

const snakeKeysToCamel = obj => {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    out[snakeToCamel(k)] = v;
  }
  return out;
};

/**
 * Verify a license JWT against the bundled RSA public key and return the
 * decoded payload. Throws if signature is invalid, the token is expired,
 * or the issuer/audience claims do not match.
 *
 * Callers that need to allow expired tokens (e.g. surfacing an "expired"
 * state to the user) should call decodeLicenseTokenUnsafe instead.
 */
export function verifyLicenseToken(token) {
  const publicKey = getPublicKey();

  const isValid = KJUR.jws.JWS.verifyJWT(token, publicKey, {
    alg: [ALGORITHM],
    iss: [ISSUER],
    aud: [AUDIENCE],
    gracePeriod: GRACE_PERIOD_SECONDS,
  });

  if (!isValid) {
    throw new Error('License token failed verification.');
  }

  return decodeLicenseTokenUnsafe(token);
}

/**
 * Decode without signature/exp checks. Used to surface the "why" of an
 * already-failed token (expired vs invalid) to the user. Do NOT grant
 * feature access from this — always run verifyLicenseToken first.
 */
export function decodeLicenseTokenUnsafe(token) {
  const parsed = KJUR.jws.JWS.parse(String(token || ''));
  const payloadObj = parsed?.payloadObj ?? {};
  const headerObj = parsed?.headerObj ?? {};

  return {
    header: headerObj,
    payload: payloadObj,
    appConfig: snakeKeysToCamel(payloadObj?.features ?? {}),
  };
}
