output "public_ip" {
  value = aws_eip.app.public_ip
}

output "instance_id" {
  value = aws_instance.app.id
}

output "config_secret_arn" {
  value = aws_secretsmanager_secret.app_config.arn
}
