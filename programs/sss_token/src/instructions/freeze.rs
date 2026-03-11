use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface, FreezeAccount, freeze_account, ThawAccount, thaw_account};
use crate::state::StablecoinState;
use crate::errors::StablecoinError;

#[derive(Accounts)]
pub struct FreezeThaw<'info> {
    pub authority: Signer<'info>,

    #[account(
        seeds = [b"state", mint.key().as_ref()],
        bump,
    )]
    pub state: Account<'info, StablecoinState>,

    #[account(mut)]
    pub mint: InterfaceAccount<'info, Mint>,

    #[account(mut)]
    pub target_account: InterfaceAccount<'info, TokenAccount>,

    pub token_program: Interface<'info, TokenInterface>,
}

pub fn process_freeze(ctx: Context<FreezeThaw>) -> Result<()> {
    require!(
        ctx.accounts.state.pauser == ctx.accounts.authority.key() || ctx.accounts.state.master_authority == ctx.accounts.authority.key(),
        StablecoinError::UnauthorizedFreezer
    );
    
    let mint_key = ctx.accounts.mint.key();
    let seeds = &[
        b"state",
        mint_key.as_ref(),
        &[ctx.bumps.state],
    ];
    let signer = &[&seeds[..]];

    freeze_account(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            FreezeAccount {
                account: ctx.accounts.target_account.to_account_info(),
                mint: ctx.accounts.mint.to_account_info(),
                authority: ctx.accounts.state.to_account_info(),
            },
            signer,
        )
    )?;
    Ok(())
}

pub fn process_thaw(ctx: Context<FreezeThaw>) -> Result<()> {
    require!(
        ctx.accounts.state.pauser == ctx.accounts.authority.key() || ctx.accounts.state.master_authority == ctx.accounts.authority.key(),
        StablecoinError::UnauthorizedFreezer
    );
    
    let mint_key = ctx.accounts.mint.key();
    let seeds = &[
        b"state",
        mint_key.as_ref(),
        &[ctx.bumps.state],
    ];
    let signer = &[&seeds[..]];

    thaw_account(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            ThawAccount {
                account: ctx.accounts.target_account.to_account_info(),
                mint: ctx.accounts.mint.to_account_info(),
                authority: ctx.accounts.state.to_account_info(),
            },
            signer,
        )
    )?;
    Ok(())
}
