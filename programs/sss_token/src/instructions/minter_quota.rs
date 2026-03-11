use anchor_lang::prelude::*;
use crate::state::StablecoinState;
use crate::errors::StablecoinError;

/// Per-minter quota account — stored as a PDA derived from [b"quota", mint, minter]
#[account]
#[derive(Default)]
pub struct MinterQuota {
    /// The mint this quota applies to
    pub mint: Pubkey,
    /// The minter this quota applies to
    pub minter: Pubkey,
    /// Maximum tokens this minter can mint per period (0 = unlimited)
    pub max_quota: u64,
    /// How much this minter has minted in the current period
    pub minted_this_period: u64,
    /// Unix timestamp when the current period started
    pub period_start: i64,
    /// Period duration in seconds (0 = no automatic reset)
    pub period_duration: i64,
}

impl MinterQuota {
    pub const MAX_SIZE: usize = 8 + 32 + 32 + 8 + 8 + 8 + 8;
}

// ─── init_minter_quota ───────────────────────────────────────────────────────

#[derive(Accounts)]
pub struct InitMinterQuota<'info> {
    #[account(mut)]
    pub master_authority: Signer<'info>,

    #[account(
        seeds = [b"state", mint.key().as_ref()],
        bump,
        has_one = master_authority @ StablecoinError::UnauthorizedMaster
    )]
    pub state: Account<'info, StablecoinState>,

    pub mint: InterfaceAccount<'info, anchor_spl::token_interface::Mint>,

    /// CHECK: The minter whose quota is being set. Validated in handler.
    pub minter: UncheckedAccount<'info>,

    #[account(
        init,
        payer = master_authority,
        space = 8 + MinterQuota::MAX_SIZE,
        seeds = [b"quota", mint.key().as_ref(), minter.key().as_ref()],
        bump,
    )]
    pub quota: Account<'info, MinterQuota>,

    pub system_program: Program<'info, System>,
}

pub fn process_init_minter_quota(
    ctx: Context<InitMinterQuota>,
    max_quota: u64,
    period_duration: i64,
) -> Result<()> {
    let state = &ctx.accounts.state;
    let minter_key = ctx.accounts.minter.key();

    require!(
        state.minters.contains(&minter_key),
        StablecoinError::UnauthorizedMinter
    );

    let quota = &mut ctx.accounts.quota;
    let now = Clock::get()?.unix_timestamp;

    quota.mint = ctx.accounts.mint.key();
    quota.minter = minter_key.clone();
    quota.max_quota = max_quota;
    quota.period_duration = period_duration;
    quota.minted_this_period = 0;
    quota.period_start = now;

    msg!("Quota initialized for minter {}: max={}, period={}s", minter_key, max_quota, period_duration);
    Ok(())
}

// ─── update_minter_quota ─────────────────────────────────────────────────────

#[derive(Accounts)]
pub struct UpdateMinterQuota<'info> {
    pub master_authority: Signer<'info>,

    #[account(
        seeds = [b"state", mint.key().as_ref()],
        bump,
        has_one = master_authority @ StablecoinError::UnauthorizedMaster
    )]
    pub state: Account<'info, StablecoinState>,

    pub mint: InterfaceAccount<'info, anchor_spl::token_interface::Mint>,

    /// CHECK: The minter whose quota is being updated.
    pub minter: UncheckedAccount<'info>,

    #[account(
        mut,
        seeds = [b"quota", mint.key().as_ref(), minter.key().as_ref()],
        bump,
    )]
    pub quota: Account<'info, MinterQuota>,
}

pub fn process_update_minter_quota(
    ctx: Context<UpdateMinterQuota>,
    max_quota: u64,
    period_duration: i64,
) -> Result<()> {
    let quota = &mut ctx.accounts.quota;
    let now = Clock::get()?.unix_timestamp;

    quota.max_quota = max_quota;
    quota.period_duration = period_duration;
    quota.minted_this_period = 0;
    quota.period_start = now;

    msg!("Quota updated: max={}, period={}s", max_quota, period_duration);
    Ok(())
}

// ─── check_and_update_quota (helper for mint.rs) ─────────────────────────────

pub fn check_and_update_quota(quota: &mut MinterQuota, amount: u64) -> Result<()> {
    if quota.max_quota == 0 {
        return Ok(());
    }

    let now = Clock::get()?.unix_timestamp;

    // Auto-reset period if expired
    if quota.period_duration > 0 && now >= quota.period_start + quota.period_duration {
        quota.minted_this_period = 0;
        quota.period_start = now;
    }

    let new_total = quota.minted_this_period
        .checked_add(amount)
        .ok_or(StablecoinError::MinterQuotaExceeded)?;

    require!(new_total <= quota.max_quota, StablecoinError::MinterQuotaExceeded);

    quota.minted_this_period = new_total;
    Ok(())
}
