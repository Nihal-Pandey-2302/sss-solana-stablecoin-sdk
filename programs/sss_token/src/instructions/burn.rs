use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface, Burn, burn};
use crate::state::StablecoinState;
use crate::errors::StablecoinError;

#[derive(Accounts)]
pub struct BurnTokens<'info> {
    pub burner: Signer<'info>,

    #[account(
        seeds = [b"state", mint.key().as_ref()],
        bump,
    )]
    pub state: Account<'info, StablecoinState>,

    #[account(mut)]
    pub mint: InterfaceAccount<'info, Mint>,

    #[account(mut)]
    pub from: InterfaceAccount<'info, TokenAccount>,

    pub token_program: Interface<'info, TokenInterface>,
}

pub fn process_burn(ctx: Context<BurnTokens>, amount: u64) -> Result<()> {
    require!(!ctx.accounts.state.is_paused, StablecoinError::TokenPaused);
    require!(
        ctx.accounts.state.burner == ctx.accounts.burner.key() || ctx.accounts.state.master_authority == ctx.accounts.burner.key(),
        StablecoinError::UnauthorizedBurner
    );

    burn(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Burn {
                mint: ctx.accounts.mint.to_account_info(),
                from: ctx.accounts.from.to_account_info(),
                authority: ctx.accounts.burner.to_account_info(),
            },
        ),
        amount,
    )?;

    Ok(())
}
