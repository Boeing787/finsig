resource "aws_db_subnet_group" "this" {
  name       = "${var.name}-db"
  subnet_ids = var.subnet_ids
}

resource "aws_db_instance" "this" {
  identifier                   = "${var.name}-postgres"
  engine                       = "postgres"
  engine_version               = "17"
  instance_class               = var.instance_class
  allocated_storage            = var.allocated_storage
  storage_type                 = "gp3"
  storage_encrypted            = true
  db_name                      = "finsig"
  username                     = "finsig_admin"
  manage_master_user_password  = true
  db_subnet_group_name         = aws_db_subnet_group.this.name
  vpc_security_group_ids       = [var.security_group_id]
  publicly_accessible          = false
  multi_az                     = false
  backup_retention_period      = 7
  auto_minor_version_upgrade   = true
  deletion_protection          = true
  skip_final_snapshot          = false
  final_snapshot_identifier    = "${var.name}-final"
  copy_tags_to_snapshot        = true
  performance_insights_enabled = false
}
