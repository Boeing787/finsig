output "public_subnet_id" {
  value = aws_subnet.public.id
}

output "database_subnet_ids" {
  value = aws_subnet.database[*].id
}

output "app_security_group_id" {
  value = aws_security_group.app.id
}

output "database_security_group_id" {
  value = aws_security_group.database.id
}
