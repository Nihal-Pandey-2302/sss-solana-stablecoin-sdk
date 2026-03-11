use anchor_lang::prelude::*;
use crate::state::StablecoinState;
use crate::errors::StablecoinError;

#[derive(Accounts)]
pub struct PauseUnpause<'info> {
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [b"state", mint.key().as_ref()],
        bump,
    )]
    pub state: Account<'info, StablecoinState>,

    pub mint: InterfaceAccount<'info, anchor_spl::token_interface::Mint>,
}

pub fn process_pause(ctx: Context<PauseUnpause>) -> Result<()> {
    require!(
        ctx.accounts.state.master_authority == ctx.accounts.authority.key() || ctx.accounts.state.pauser == ctx.accounts.authority.key(),
        StablecoinError::UnauthorizedMaster
    );
    ctx.accounts.state.is_paused = true;
    Ok(())
}

pub fn process_unpause(ctx: Context<PauseUnpause>) -> Result<()> {
    require!(
        ctx.accounts.state.master_authority == ctx.accounts.authority.key() || ctx.accounts.state.pauser == ctx.accounts.authority.key(),
        StablecoinError::UnauthorizedMaster
    );
    ctx.accounts.state.is_paused = false;
    Ok(())
}
