use anchor_lang::prelude::*;
use anchor_spl::token_interface::{burn, Burn, Mint, TokenAccount, TokenInterface};

use crate::state::StablecoinState;

#[derive(Accounts)]
pub struct SeizeTokens<'info> {
    /// The authority executing the seize. Must be the master or blacklister.
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        seeds = [b"state", mint.key().as_ref()],
        bump,
        has_one = mint,
    )]
    pub state: Account<'info, StablecoinState>,

    /// The token mint
    #[account(mut)]
    pub mint: InterfaceAccount<'info, Mint>,

    /// The account to seize tokens from
    #[account(mut)]
    pub target_account: InterfaceAccount<'info, TokenAccount>,

    pub token_program: Interface<'info, TokenInterface>,
}

pub fn process_seize(ctx: Context<SeizeTokens>, amount: u64) -> Result<()> {
    let state = &ctx.accounts.state;

    // Only master or blacklister can seize
    require!(
        ctx.accounts.authority.key() == state.master_authority
            || ctx.accounts.authority.key() == state.blacklister,
        crate::errors::StablecoinError::UnauthorizedBlacklister
    );

    // Call Token-2022 Burn using the PDA as the permanent delegate
    // The state PDA is the permanent delegate
    let mint_key = ctx.accounts.mint.key();
    let signer_seeds: &[&[&[u8]]] = &[&[
        b"state",
        mint_key.as_ref(),
        &[ctx.bumps.state],
    ]];

    let cpi_accounts = Burn {
        mint: ctx.accounts.mint.to_account_info(),
        from: ctx.accounts.target_account.to_account_info(),
        authority: ctx.accounts.state.to_account_info(),
    };

    let cpi_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        cpi_accounts,
        signer_seeds,
    );

    burn(cpi_ctx, amount)?;

    Ok(())
}
