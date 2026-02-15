variable "aws_region" {
  description = "AWS region for WAF resources"
  type        = string
  default     = "us-east-1"
}

variable "name_prefix" {
  description = "Prefix used for WAF resource names"
  type        = string
  default     = "algocampus"
}

variable "scope" {
  description = "WAF scope: REGIONAL for ALB/API Gateway, CLOUDFRONT for CloudFront"
  type        = string
  default     = "REGIONAL"
}

variable "global_rate_limit" {
  description = "Global requests per 5 minutes per IP"
  type        = number
  default     = 2000
}

