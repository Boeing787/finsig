data "aws_caller_identity" "current" {}

data "aws_availability_zones" "available" {
  state = "available"
}

locals {
  azs = slice(data.aws_availability_zones.available.names, 0, 2)
}

module "network" {
  source = "../../modules/network"
  name   = var.name
  azs    = local.azs
}

module "storage" {
  source     = "../../modules/storage"
  name       = var.name
  account_id = data.aws_caller_identity.current.account_id
  region     = var.region
}

module "identity" {
  source       = "../../modules/identity"
  name         = var.name
  account_id   = data.aws_caller_identity.current.account_id
  app_base_url = var.app_base_url
}

module "database" {
  source            = "../../modules/database"
  name              = var.name
  subnet_ids        = module.network.database_subnet_ids
  security_group_id = module.network.database_security_group_id
  instance_class    = var.db_instance_class
  allocated_storage = var.db_allocated_storage
}

module "app" {
  source             = "../../modules/app"
  name               = var.name
  subnet_id          = module.network.public_subnet_id
  security_group_id  = module.network.app_security_group_id
  instance_type      = var.ec2_instance_type
  uploads_bucket_arn = module.storage.bucket_arn

  depends_on = [module.network]
}

module "budget" {
  source             = "../../modules/budget"
  name               = var.name
  limit_usd          = var.monthly_budget_usd
  notification_email = var.budget_alert_email
}
