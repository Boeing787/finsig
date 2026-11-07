terraform {
  required_version = ">= 1.14.0, < 2.0.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }

  backend "s3" {}
}

provider "aws" {
  region              = var.region
  allowed_account_ids = ["623588627433"]

  default_tags {
    tags = {
      Project     = "finsig"
      Environment = "dev"
      ManagedBy   = "terraform"
    }
  }
}
