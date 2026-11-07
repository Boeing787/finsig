# FinSig AWS access

Target account: `623588627433`. Region: `eu-central-1`. The project uses the named `finsig-personal` profile stored in the ignored `.aws/config` file inside this repository. Its credentials and login cache also stay under the ignored `.aws/` directory. Existing profiles in the user's global AWS configuration are untouched.

Run the wrapper only from within the FinSig directory:

```bash
./scripts/aws-finsig login
./scripts/aws-finsig identity
./scripts/aws-finsig aws ec2 describe-vpcs --region eu-central-1
```

The `login` command opens a browser authorization flow. Select the personal AWS console identity for account `623588627433`; do not approve a corporate identity. The `identity` and `aws` commands verify the account through STS and refuse to continue if the result differs. The wrapper removes inherited credential environment variables and rejects profile and endpoint overrides.

The wrapper permits an identity check and blocks resource commands under root. Before provisioning EC2, RDS, budgets, or IAM resources for FinSig, configure and sign in with a non-root IAM Identity Center or IAM principal that has only the permissions needed for the project. Use the same project-local profile and verify it again with `./scripts/aws-finsig identity`.

The Terraform wrapper command is `./scripts/aws-finsig terraform <terraform-args>`. It uses the ignored project-local `finsig-terraform` credential-process profile so Terraform 1.14's S3 backend can consume the short-lived CLI login. The [infrastructure guide](../infra/README.md) has the bootstrap and dev sequence. Terraform provider and backend both pin the allowed account ID; the wrapper also blocks Terraform under root.

This is a local operator guard, not an IAM permission boundary. AWS permissions still come from the chosen principal. Do not run raw `aws` commands or set this profile as a global default for FinSig work. Before creating resources, confirm the principal's permissions and set a budget in the personal account.

If the personal account uses IAM Identity Center instead of console sign-in, configure SSO into the same project-local `AWS_CONFIG_FILE`, then adapt the login step to `aws sso login` while keeping the account check. Never paste keys or authorization codes into the repository or chat.
