import { describe, expect, it } from 'vitest';
import { getDeploymentIdentity } from './deployment-identity';

describe('getDeploymentIdentity', () => {
  it('prefers the explicit Resourceful release SHA and target environment', () => {
    expect(
      getDeploymentIdentity({
        RESOURCEFUL_BUILD_SHA: 'release-sha',
        VERCEL_GIT_COMMIT_SHA: 'vercel-sha',
        GITHUB_SHA: 'github-sha',
        VERCEL_TARGET_ENV: 'production',
        VERCEL_ENV: 'preview',
        NODE_ENV: 'production',
      })
    ).toEqual({ commit: 'release-sha', environment: 'production' });
  });

  it('uses Vercel system identity for Git-integrated deployments', () => {
    expect(
      getDeploymentIdentity({
        VERCEL_GIT_COMMIT_SHA: 'vercel-sha',
        VERCEL_ENV: 'preview',
      })
    ).toEqual({ commit: 'vercel-sha', environment: 'preview' });
  });

  it('falls back to GitHub and Node values outside Vercel', () => {
    expect(
      getDeploymentIdentity({
        GITHUB_SHA: 'github-sha',
        NODE_ENV: 'test',
      })
    ).toEqual({ commit: 'github-sha', environment: 'test' });
  });

  it('returns explicit unknown values when no deployment identity exists', () => {
    expect(getDeploymentIdentity({})).toEqual({
      commit: 'unknown',
      environment: 'unknown',
    });
  });
});
