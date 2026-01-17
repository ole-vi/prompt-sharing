import { parseParams } from './url-params.js';

const DEFAULTS = {
  owner: 'promptroot',
  repo: 'promptroot',
  branch: 'main',
};

function getConfig() {
  const params = parseParams();
  return {
    owner: params.owner || DEFAULTS.owner,
    repo: params.repo || DEFAULTS.repo,
    branch: params.branch || DEFAULTS.branch,
  };
}

export const config = getConfig();
