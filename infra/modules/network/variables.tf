variable "name" {
  type = string
}

variable "azs" {
  type = list(string)

  validation {
    condition     = length(var.azs) >= 2
    error_message = "RDS requires subnets in at least two Availability Zones."
  }
}
