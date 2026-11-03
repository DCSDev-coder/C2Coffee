-- Tiers can now bundle several achievement rewards, and each reward can be
-- claimed more than once (voucher_templates.limit_per_user = number of claims).
-- The previous index allowed only one claimable entitlement per member/tier.
-- Duplicate protection is still guaranteed by uq_tier_reward_entitlement_issue
-- (user_id, issue_case_ref), where every claim has its own issue_case_ref.

ALTER TABLE user_tier_reward_entitlements
  DROP INDEX uq_tier_reward_one_claimable_per_tier;
