resource "aws_iam_openid_connect_provider" "github_actions" {
  url            = "https://token.actions.githubusercontent.com"
  client_id_list = ["sts.amazonaws.com"]

  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_iam_role" "finsig_admin" {
  name                 = "FinSig_admin"
  path                 = "/finsig/"
  max_session_duration = 3600
  description          = "FinSig infrastructure deployment from the main branch of dmrvcodes/finsig"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid    = "GitHubMainOnly"
      Effect = "Allow"
      Principal = {
        Federated = aws_iam_openid_connect_provider.github_actions.arn
      }
      Action = "sts:AssumeRoleWithWebIdentity"
      Condition = {
        StringEquals = {
          "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
          # GitHub uses immutable OIDC subjects for repositories created after
          # 2026-07-15. The numeric IDs prevent a renamed or recycled namespace
          # from assuming this account-wide deployment role.
          "token.actions.githubusercontent.com:sub" = "repo:dmrvcodes@85731803/finsig@1449784317:ref:refs/heads/main"
        }
      }
    }]
  })

  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_iam_role_policy_attachment" "finsig_admin" {
  role       = aws_iam_role.finsig_admin.name
  policy_arn = "arn:aws:iam::aws:policy/AdministratorAccess"
}

output "github_deploy_role_arn" {
  value = aws_iam_role.finsig_admin.arn
}
