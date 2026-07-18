export interface DeploymentIdentity {
  commit: string;
  environment: string;
}

type DeploymentEnvironment = Record<string, string | undefined>;

/**
 * Resolve non-sensitive deployment identity for health checks and release
 * verification. RESOURCEFUL_BUILD_SHA is set explicitly by the production CLI
 * workflow; Vercel system values cover Git-integrated and preview deployments.
 */
export function getDeploymentIdentity(
  env: DeploymentEnvironment = process.env
): DeploymentIdentity {
  return {
    commit:
      env.RESOURCEFUL_BUILD_SHA ??
      env.VERCEL_GIT_COMMIT_SHA ??
      env.GITHUB_SHA ??
      'unknown',
    environment:
      env.VERCEL_TARGET_ENV ??
      env.VERCEL_ENV ??
      env.NODE_ENV ??
      'unknown',
  };
}
