# FinSig GitHub deployment identity

This Terraform root creates the account-level GitHub OIDC provider and one role,
`/finsig/FinSig_admin`, in AWS account `623588627433`. GitHub receives temporary
credentials only when the `dmrvcodes/finsig` workflow runs from `main`. The trust
policy requires `aud=sts.amazonaws.com` and the exact `main` subject. Pull requests,
forks and other branches cannot assume it.

The attached AWS managed `AdministratorAccess` policy is **account-wide**. The
`/finsig/` IAM path is a naming convention, not a permission boundary. Do not
publish the role ARN as a general-purpose credential or reuse this role in
unrelated repositories. Protect `main` with the required `ci-gate` check before
using the role for automated AWS deployments.

Use a non-root IAM or SSO principal in the personal AWS account:

```bash
./scripts/aws-finsig identity
./scripts/aws-finsig terraform -chdir=infra/deploy-identity init
./scripts/aws-finsig terraform -chdir=infra/deploy-identity plan -out=deploy-identity.tfplan
./scripts/aws-finsig terraform -chdir=infra/deploy-identity apply deploy-identity.tfplan
```

The `scripts/aws-finsig` wrapper refuses resource commands under root or any
other AWS account. This root uses local Terraform state, which is gitignored;
back it up securely after apply. If the GitHub OIDC provider already exists in
this AWS account, import its ARN into
`aws_iam_openid_connect_provider.github_actions` before planning. Do not create
a second account-global provider.

The role is reserved for a future AWS Terraform deployment job. The live demo
currently deploys to Render after GitHub `ci-gate`; it does not need AWS
credentials. Do not enable automatic AWS apply until the app stack and state
backend are ready.
