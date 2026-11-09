terraform {
  required_version = ">= 1.14.0, < 2.0.0"

  backend "s3" {}

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }
}

provider "aws" {
  region              = "eu-central-1"
  allowed_account_ids = ["623588627433"]

  default_tags {
    tags = {
      Project   = "finsig"
      ManagedBy = "terraform"
      Layer     = "deploy-identity"
    }
  }
}
