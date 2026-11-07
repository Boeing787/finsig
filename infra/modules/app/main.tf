data "aws_ssm_parameter" "al2023_ami" {
  name = "/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-x86_64"
}

data "aws_iam_policy_document" "ec2_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ec2.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "app" {
  name               = "${var.name}-ec2"
  assume_role_policy = data.aws_iam_policy_document.ec2_assume.json
}

resource "aws_iam_role_policy_attachment" "ssm" {
  role       = aws_iam_role.app.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_instance_profile" "app" {
  name = "${var.name}-ec2"
  role = aws_iam_role.app.name
}

resource "aws_secretsmanager_secret" "app_config" {
  name                    = "${var.name}/app-config"
  description             = "Application secrets; value populated outside Terraform"
  recovery_window_in_days = 7
}

data "aws_iam_policy_document" "app" {
  statement {
    sid       = "ReadAppConfiguration"
    actions   = ["secretsmanager:GetSecretValue"]
    resources = [aws_secretsmanager_secret.app_config.arn]
  }

  statement {
    sid     = "UploadDocuments"
    actions = ["s3:GetObject", "s3:PutObject"]
    resources = [
      "${var.uploads_bucket_arn}/documents/*"
    ]
  }

  statement {
    sid       = "ListUploadedDocuments"
    actions   = ["s3:ListBucket"]
    resources = [var.uploads_bucket_arn]
    condition {
      test     = "StringLike"
      variable = "s3:prefix"
      values   = ["documents/*"]
    }
  }

  statement {
    sid       = "WriteAppLogs"
    actions   = ["logs:CreateLogStream", "logs:PutLogEvents"]
    resources = ["${trimsuffix(aws_cloudwatch_log_group.app.arn, ":*")}:*"]
  }
}

resource "aws_iam_role_policy" "app" {
  name   = "${var.name}-app"
  role   = aws_iam_role.app.id
  policy = data.aws_iam_policy_document.app.json
}

resource "aws_cloudwatch_log_group" "app" {
  name              = "/finsig/${var.name}/app"
  retention_in_days = 14
}

resource "aws_instance" "app" {
  ami                         = data.aws_ssm_parameter.al2023_ami.value
  instance_type               = var.instance_type
  subnet_id                   = var.subnet_id
  vpc_security_group_ids      = [var.security_group_id]
  iam_instance_profile        = aws_iam_instance_profile.app.name
  associate_public_ip_address = false
  monitoring                  = false

  metadata_options {
    http_tokens                 = "required"
    http_endpoint               = "enabled"
    http_put_response_hop_limit = 2
  }

  root_block_device {
    volume_type           = "gp3"
    volume_size           = 20
    encrypted             = true
    delete_on_termination = true
  }

  tags = { Name = "${var.name}-app" }

  depends_on = [aws_iam_role_policy_attachment.ssm]
}

resource "aws_eip" "app" {
  domain   = "vpc"
  instance = aws_instance.app.id
  tags     = { Name = "${var.name}-app" }
}
