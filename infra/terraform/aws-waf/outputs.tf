output "web_acl_arn" {
  value       = aws_wafv2_web_acl.algocampus_api_acl.arn
  description = "ARN of the AlgoCampus API WAF ACL"
}

