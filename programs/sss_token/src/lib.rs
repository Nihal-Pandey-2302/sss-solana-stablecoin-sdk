use anchor_lang::prelude::*;

declare_id!("F7igqZa75yYPnXBBKUK3hDwEmtfwUWogEcWMsh5v6FyR");

pub mod errors;
pub mod instructions;
pub mod state;

use instructions::*;

#[program]
pub mod sss_token {
    use super::*;

    pub fn initialize(
        ctx: Context<Initialize>,
        minters: Vec<Pubkey>,
        burner: Pubkey,
        pauser: Pubkey,
        blacklister: Pubkey,
    ) -> Result<()> {
        process_initialize(ctx, minters, burner, pauser, blacklister)
    }

    pub fn transfer_authority(
        ctx: Context<TransferAuthority>,
        new_master: Option<Pubkey>,
        new_minters: Option<Vec<Pubkey>>,
        new_burner: Option<Pubkey>,
        new_pauser: Option<Pubkey>,
        new_blacklister: Option<Pubkey>,
    ) -> Result<()> {
        instructions::process_transfer_authority(
            ctx,
            new_master,
            new_minters,
            new_burner,
            new_pauser,
            new_blacklister,
        )
    }

    pub fn add_to_blacklist(ctx: Context<AddToBlacklist>) -> Result<()> {
        instructions::process_add_to_blacklist(ctx)
    }

    pub fn remove_from_blacklist(ctx: Context<RemoveFromBlacklist>) -> Result<()> {
        instructions::process_remove_from_blacklist(ctx)
    }

    pub fn mint(ctx: Context<MintTokens>, amount: u64) -> Result<()> {
        process_mint(ctx, amount)
    }

    pub fn burn(ctx: Context<BurnTokens>, amount: u64) -> Result<()> {
        process_burn(ctx, amount)
    }

    pub fn freeze_account(ctx: Context<FreezeThaw>) -> Result<()> {
        process_freeze(ctx)
    }

    pub fn thaw_account(ctx: Context<FreezeThaw>) -> Result<()> {
        process_thaw(ctx)
    }

    pub fn seize(ctx: Context<SeizeTokens>, amount: u64) -> Result<()> {
        process_seize(ctx, amount)
    }

    pub fn pause(ctx: Context<PauseUnpause>) -> Result<()> {
        process_pause(ctx)
    }

    pub fn unpause(ctx: Context<PauseUnpause>) -> Result<()> {
        process_unpause(ctx)
    }

    /// Create a per-period minting quota PDA for a specific minter.
    pub fn init_minter_quota(
        ctx: Context<InitMinterQuota>,
        max_quota: u64,
        period_duration: i64,
    ) -> Result<()> {
        process_init_minter_quota(ctx, max_quota, period_duration)
    }

    /// Update an existing minter quota (resets the period).
    pub fn update_minter_quota(
        ctx: Context<UpdateMinterQuota>,
        max_quota: u64,
        period_duration: i64,
    ) -> Result<()> {
        process_update_minter_quota(ctx, max_quota, period_duration)
    }
}


