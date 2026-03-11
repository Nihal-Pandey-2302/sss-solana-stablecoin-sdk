use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface, MintTo, mint_to};
use crate::state::StablecoinState;
use crate::errors::StablecoinError;

#[derive(Accounts)]
pub struct MintTokens<'info> {
    pub minter: Signer<'info>,

    #[account(
        seeds = [b"state", mint.key().as_ref()],
        bump,
    )]
    pub state: Account<'info, StablecoinState>,

    #[account(mut)]
    pub mint: InterfaceAccount<'info, Mint>,

    #[account(mut)]
    pub recipient: InterfaceAccount<'info, TokenAccount>,

    pub token_program: Interface<'info, TokenInterface>,
}

pub fn process_mint(ctx: Context<MintTokens>, amount: u64) -> Result<()> {
    let state = &ctx.accounts.state;
    
    require!(!state.is_paused, StablecoinError::TokenPaused);
    require!(
        state.minters.contains(&ctx.accounts.minter.key()),
        StablecoinError::UnauthorizedMinter
    );

    let mint_key = ctx.accounts.mint.key();
    let seeds = &[
        b"state",
        mint_key.as_ref(),
        &[ctx.bumps.state],
    ];
    let signer = &[&seeds[..]];

    mint_to(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            MintTo {
                mint: ctx.accounts.mint.to_account_info(),
                to: ctx.accounts.recipient.to_account_info(),
                authority: state.to_account_info(),
            },
            signer,
        ),
        amount,
    )?;

    Ok(())
}
