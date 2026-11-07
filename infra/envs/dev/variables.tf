variable "region" {
  type    = string
  default = "eu-central-1"

  validation {
    condition     = var.region == "eu-central-1"
    error_message = "FinSig dev is pinned to eu-central-1."
  }
}

variable "name" {
  type    = string
  default = "finsig-dev"

  validation {
    condition     = can(regex("^[a-z][a-z0-9-]{2,30}$", var.name))
    error_message = "name must be lowercase letters, numbers and hyphens, 3–31 characters."
  }
}

variable "app_base_url" {
  description = "Public HTTPS origin used for Cognito callback and logout URLs."
  type        = string

  validation {
    condition     = can(regex("^https://[^/]+$", var.app_base_url))
    error_message = "app_base_url must be an HTTPS origin without a trailing slash or path."
  }
}

variable "budget_alert_email" {
  description = "Email to receive account-wide AWS budget alerts."
  type        = string

  validation {
    condition     = can(regex("^[^@[:space:]]+@[^@[:space:]]+\\.[^@[:space:]]+$", var.budget_alert_email))
    error_message = "budget_alert_email must be an email address."
  }
}

variable "monthly_budget_usd" {
  type    = string
  default = "100"

  validation {
    condition     = can(tonumber(var.monthly_budget_usd) > 0)
    error_message = "monthly_budget_usd must be positive."
  }
}

variable "ec2_instance_type" {
  type    = string
  default = "t3.small"
}

variable "db_instance_class" {
  type    = string
  default = "db.t4g.micro"
}

variable "db_allocated_storage" {
  type    = number
  default = 20

  validation {
    condition     = var.db_allocated_storage >= 20
    error_message = "db_allocated_storage must be at least 20 GiB."
  }
}
