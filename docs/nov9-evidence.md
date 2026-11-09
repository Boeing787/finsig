# 9 November delivery evidence

## Hosted application

- Public URL: <https://finsig-demo.onrender.com/demo>
- Main page and `/demo`: HTTP 200.
- AI classification (`POST /api/demo/ai`, task `classify`): HTTP 200; response contained `record_id`, `activity_id`, evidence fields, question and model.
- AI explanation (`POST /api/demo/ai`, task `explain`): HTTP 200; response contained claims with validated metric IDs and record IDs.
- Anthropic model observed: `claude-sonnet-4-6`.
- Ten repeated production smoke cycles checked `/`, `/demo`, classify and explain: 40 route calls, all HTTP 200, all AI response shapes present. AI responses are cached by the server for one hour, so repeated cycles confirm public route stability and response shape, not ten distinct model generations.
- HTTP GET to the AI endpoint returns 405, as expected for the POST-only route.

## GitHub and Render deployment

- CI run: [42593629523](https://github.com/dmrvcodes/finsig/actions/runs/42593629523), conclusion `success`.
- Deploy run: [42593713481](https://github.com/dmrvcodes/finsig/actions/runs/42593713481), conclusion `success`.
- Deployed commit: `d6954ba39b889e62a964c5c3036e369be4a948df`.
- Render deploy reached `live`; `/demo` smoke check passed.
- `main` requires the `ci-gate` status and pull requests; linear history is enabled.

## AWS deployment identity and state

- IAM role ARN: `arn:aws:iam::623588627433:role/finsig/FinSig_admin`.
- Trust is restricted to OIDC audience `sts.amazonaws.com` and subject `repo:dmrvcodes/finsig:ref:refs/heads/main`.
- Attached policy: `AdministratorAccess` (account-wide permissions).
- Terraform returned `No changes` after role creation.
- S3 state bucket: `finsig-tfstate-623588627433-eu-central-1`; encrypted, versioned, blocked public access, and denies insecure transport.
- `infra/deploy-identity` state was migrated from local storage to S3 key `deploy-identity/terraform.tfstate`; S3 lock files are enabled.
- AWS infrastructure automation is not enabled. The live application deploys to Render after `ci-gate`; the Terraform app stack remains a baseline.

## Scope of the manual review

The production smoke check verified route availability and response contracts. A browser-based incognito review of navigation, local-storage reset, loading/error visuals, and a Render free-tier cold start was not automated in this run. Render was changed by the user to a paid compute plan during the deployment; this removes the free-tier sleep behavior, but the resulting billing cost is controlled in the Render workspace.
