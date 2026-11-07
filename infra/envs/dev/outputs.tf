output "account_id" {
  value = data.aws_caller_identity.current.account_id
}

output "app_public_ip" {
  value = module.app.public_ip
}

output "app_instance_id" {
  value = module.app.instance_id
}

output "db_host" {
  value = module.database.address
}

output "db_master_secret_arn" {
  value = module.database.master_secret_arn
}

output "app_config_secret_arn" {
  value = module.app.config_secret_arn
}

output "uploads_bucket" {
  value = module.storage.bucket_name
}

output "cognito_user_pool_id" {
  value = module.identity.user_pool_id
}

output "cognito_client_id" {
  value = module.identity.client_id
}

output "cognito_issuer" {
  value = "https://cognito-idp.${var.region}.amazonaws.com/${module.identity.user_pool_id}"
}
