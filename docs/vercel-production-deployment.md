# Resourceful production deployment

Resourceful's canonical production URL is:

- `https://resourceful-7x38.vercel.app`

The authoritative Vercel target is:

- Team: `revaluate`
- Organization ID: `team_ssX7cPECdHvXGFHSOuS9iXos`
- Project: `resourceful-7x38`
- Project ID: `prj_j6M19RLIb5zIyju5W8J2meEDESqG`

The separate Vercel project named `resourceful` is connected to the unrelated `J2C` repository. Never link or deploy this codebase to that project.

The repository includes `.github/workflows/deploy-production.yml`. After the one required secret is configured, every push or merge to `main` will:

1. install the locked dependencies with Node.js 22 and pnpm 9.15.5;
2. assert the repository toolchain contract;
3. run lint, TypeScript, and unit tests;
4. bind the Vercel CLI to the exact team and project IDs above;
5. pull production settings and confirm the returned project identity;
6. pull production environment variables and require `NEXT_PUBLIC_APP_URL=https://resourceful-7x38.vercel.app`;
7. build the production artifact with the pinned Vercel CLI;
8. deploy that exact artifact to Vercel production;
9. verify the immutable deployment URL reports the released Git commit; and
10. verify the canonical domain has promoted to the same commit and production environment.

## One-time GitHub environment setup

In GitHub, open **Settings → Environments → production** and add one environment secret:

- `VERCEL_TOKEN`

The organization and project IDs are non-secret routing identifiers and are pinned in the workflow. Do not create duplicate `VERCEL_ORG_ID` or `VERCEL_PROJECT_ID` secrets; doing so adds ambiguity without improving security.

Create a scoped Vercel token from the `revaluate` account/team that owns `resourceful-7x38`, then save it as `VERCEL_TOKEN` in GitHub's `production` environment.

Recommended production-environment controls:

- restrict which branches may deploy to `main`;
- require manual approval temporarily if real payments are enabled before CI is stable;
- limit environment-secret access to the production workflow; and
- rotate the token immediately if it is exposed in logs, screenshots, or chat.

## Required Vercel production configuration

The `resourceful-7x38` production environment must contain:

```text
NEXT_PUBLIC_APP_URL=https://resourceful-7x38.vercel.app
```

A Vercel dashboard URL such as `vercel.com/revaluate/resourceful-7x38` is not an application origin and will fail the release check.

The repository pins Node.js through `package.json`:

```json
{
  "packageManager": "pnpm@9.15.5",
  "engines": {
    "node": "22.x",
    "pnpm": "9.x"
  }
}
```

The package contract is authoritative even if the Vercel dashboard displays a different default Node version. The workflow still checks the repository values before deployment.

## Deployment identity contract

`GET /api/health` returns non-sensitive deployment identity:

```json
{
  "healthy": true,
  "deployment": {
    "commit": "<full git sha>",
    "environment": "production"
  }
}
```

The workflow stamps each CLI deployment with `RESOURCEFUL_BUILD_SHA=$GITHUB_SHA`. Vercel's Git/system variables remain fallbacks for Git-integrated previews and other environments.

A release is successful only when:

- the immutable deployment URL returns `healthy: true`;
- its deployment commit equals `GITHUB_SHA`;
- its environment equals `production`;
- the canonical domain returns the same commit; and
- the canonical domain reports `production`.

This prevents a successful build from being mistaken for a successful alias promotion and detects stale production deployments.

## Production branch

The workflow treats `main` as the production branch. Pull requests remain non-production until merged.

Recommended branch protection for `main`:

- require the `CI / quality` check once GitHub Actions billing/runner availability is restored;
- require the branch to be current before merge;
- disallow force pushes;
- require pull requests for normal changes; and
- restrict production-environment secret access to the production workflow.

## Manual production deployment

The workflow also supports **Actions → Deploy Resourceful to Vercel → Run workflow**. A manual run deploys the current `main` commit through the same validation, project-binding, build, immutable-health, and alias-promotion checks.

Do not use an ad hoc Vercel dashboard redeploy as the primary release path. A dashboard redeploy can reproduce stale environment or project-linking mistakes and does not prove that the canonical alias points to the intended Git commit.

## Failure behavior

The workflow fails closed when any of the following occurs:

- `VERCEL_TOKEN` is missing;
- the repository toolchain drifts from Node 22 or pnpm 9.15.5;
- lint, type check, or tests fail;
- Vercel returns a different team or project ID;
- `NEXT_PUBLIC_APP_URL` is missing or malformed;
- the production build fails;
- the deployment fails;
- the immutable deployment is unhealthy;
- the immutable deployment reports the wrong commit/environment; or
- the canonical alias is unhealthy, stale, or not production.

No failed release should be described as deployed merely because Vercel produced a URL.