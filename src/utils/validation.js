import { TRUSTED_DOMAINS } from './constants.js';

// ===== Validation Functions =====

// URL Scheme Validation
export function isUrlSafe(url) {
  if (!url || typeof url !== 'string') return false;

  try {
    const parsedUrl = new URL(url);
    const protocol = parsedUrl.protocol.toLowerCase();

    // Allow https everywhere
    if (protocol === 'https:') {
      return true;
    }

    // Allow http only for trusted domains
    if (protocol === 'http:') {
      return TRUSTED_DOMAINS.includes(parsedUrl.hostname);
    }

    // Block everything else (javascript:, data:, file:, content:, etc.)
    return false;
  } catch (e) {
    // Invalid URL format
    return false;
  }
}

// GitHub Owner (Username/Organization) Validation
export function validateOwner(owner) {
  if (typeof owner !== 'string' || owner.length < 1 || owner.length > 39) {
    return false;
  }
  // Alphanumeric characters and single hyphens
  // Cannot start or end with a hyphen, and no consecutive hyphens
  const validOwnerRegex = /^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/;
  return validOwnerRegex.test(owner);
}

// GitHub Repository Validation
export function validateRepo(repo) {
  if (typeof repo !== 'string' || repo.length < 1 || repo.length > 100) {
    return false;
  }
  // Alphanumeric characters, hyphens, underscores, and periods
  // Cannot be '.' or '..'
  const validRepoRegex = /^(?!^\.$)(?!^\.\.$)[a-zA-Z0-9_.-]+$/;
  return validRepoRegex.test(repo);
}

// Git Branch Name Validation
export function validateBranch(branch) {
  if (typeof branch !== 'string' || branch.length < 1 || branch.length > 250) {
    return false;
  }
  // Cannot start or end with '/', no '..' or '@{'
  const invalidPatterns = [
    /^\//,    // Starts with '/'
    /\/$/,    // Ends with '/'
    /\/\//,  // Contains '//'
    /\.\./,   // Contains '..'
    /@\{/,   // Contains '@{'
    /\\/,     // Contains '\'
  ];

  for (const pattern of invalidPatterns) {
    if (pattern.test(branch)) {
      return false;
    }
  }

  // Control characters and some special characters are not allowed
  // eslint-disable-next-line no-control-regex
  const controlCharsRegex = /[\u0000-\u001f\u007f~^:?*\[\]]/;
  if (controlCharsRegex.test(branch)) {
    return false;
  }

  return true;
}
